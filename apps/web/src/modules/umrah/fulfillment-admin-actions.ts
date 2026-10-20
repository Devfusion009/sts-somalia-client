"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { notifyUmrahBooking } from "@/modules/umrah/notify";
import { stageErrorMessage } from "@/modules/umrah/stage-errors";

export type FulfillmentActionState = { error: string | null } | null;

const BUCKET = "umrah-documents";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const stageSchema = z.enum([
  "booked",
  "confirmed",
  "visa_processing",
  "visa_issued",
  "travel_confirmed",
  "documents_ready",
  "completed",
]);

const docTypeSchema = z.enum(["visa", "e_ticket", "hotel_voucher", "itinerary", "insurance", "other"]);

function revalidateBooking(bookingId: string) {
  revalidatePath("/admin/umrah/bookings");
  revalidatePath(`/admin/umrah/bookings/${bookingId}`);
  revalidatePath("/admin/umrah/departures", "layout");
  revalidatePath("/account/bookings", "layout");
  revalidatePath("/agent/bookings", "layout");
}

export async function advanceUmrahStage(
  _prev: FulfillmentActionState,
  formData: FormData
): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  if (!bookingId.success) return { error: "Invalid booking." };
  const stage = stageSchema.safeParse(formData.get("stage"));
  if (!stage.success) return { error: "Choose a stage." };
  const note = String(formData.get("note") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_umrah_booking_stage", {
    p_booking_id: bookingId.data,
    p_stage: stage.data,
    p_note: note || undefined,
  });
  if (error) return { error: stageErrorMessage(error.message) };

  void notifyUmrahBooking(bookingId.data, "stage_changed", undefined, stage.data);
  revalidateBooking(bookingId.data);
  return { error: null };
}

export async function uploadUmrahDocument(
  _prev: FulfillmentActionState,
  formData: FormData
): Promise<FulfillmentActionState> {
  const admin = await requirePlatformAdmin();
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  if (!bookingId.success) return { error: "Invalid booking." };
  const docType = docTypeSchema.safeParse(formData.get("docType"));
  if (!docType.success) return { error: "Choose a document type." };
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Enter a title." };
  if (title.length > 120) return { error: "Title must be 120 characters or fewer." };
  const pilgrimRaw = String(formData.get("pilgrimId") ?? "");
  const pilgrimId = pilgrimRaw ? z.string().uuid().safeParse(pilgrimRaw) : null;
  if (pilgrimId && !pilgrimId.success) return { error: "Invalid pilgrim." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_FILE_BYTES) return { error: "Files must be 10MB or smaller." };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: "Upload a PDF, JPG, PNG or WebP file." };

  const supabase = await createClient();

  if (pilgrimId?.success) {
    const { data: pilgrim } = await supabase
      .from("umrah_pilgrims")
      .select("id")
      .eq("id", pilgrimId.data)
      .eq("booking_id", bookingId.data)
      .maybeSingle();
    if (!pilgrim) return { error: "Pilgrim not found on this booking." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storagePath = `${bookingId.data}/${docType.data}-${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("umrah_booking_documents").insert({
    booking_id: bookingId.data,
    pilgrim_id: pilgrimId?.success ? pilgrimId.data : null,
    doc_type: docType.data,
    title,
    storage_path: storagePath,
    file_name: file.name,
    file_size: file.size,
    content_type: file.type,
    uploaded_by: admin.id,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: error.message };
  }

  revalidateBooking(bookingId.data);
  return { error: null };
}

export async function deleteUmrahDocument(
  _prev: FulfillmentActionState,
  formData: FormData
): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  const documentId = z.string().uuid().safeParse(formData.get("documentId"));
  if (!documentId.success) return { error: "Invalid document." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("umrah_booking_documents")
    .select("id, booking_id, storage_path")
    .eq("id", documentId.data)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  if (storageError) return { error: storageError.message };

  const { error } = await supabase.from("umrah_booking_documents").delete().eq("id", doc.id);
  if (error) return { error: error.message };

  revalidateBooking(doc.booking_id);
  return { error: null };
}

/**
 * Staff cancel a booking. Unpaid: the order is cancelled outright. Paid: an
 * approved cancellation request for the amount entered here is opened, so
 * the refund is paid out from /admin/refunds like any other.
 */
export async function cancelUmrahBooking(
  _prev: FulfillmentActionState,
  formData: FormData
): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  if (!bookingId.success) return { error: "Invalid booking." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Enter a reason." };
  if (reason.length > 500) return { error: "Keep the reason under 500 characters." };
  const amountRaw = String(formData.get("refundAmount") ?? "").trim();
  const amount = amountRaw ? z.coerce.number().min(0).safeParse(amountRaw) : null;
  if (amount && !amount.success) return { error: "Enter a refund of zero or more." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_umrah_booking", {
    p_booking_id: bookingId.data,
    p_reason: reason,
    p_refund_amount: amount?.success ? amount.data : undefined,
  });
  if (error) return { error: error.message };

  void notifyUmrahBooking(bookingId.data, "booking_cancelled", reason);
  revalidateBooking(bookingId.data);
  revalidatePath("/admin/refunds");
  return { error: null };
}

export async function reviewUmrahDocument(
  _prev: FulfillmentActionState,
  formData: FormData
): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  const documentId = z.string().uuid().safeParse(formData.get("documentId"));
  if (!documentId.success) return { error: "Invalid document." };
  const decision = z.enum(["accepted", "rejected"]).safeParse(formData.get("decision"));
  if (!decision.success) return { error: "Choose a decision." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (decision.data === "rejected" && !note) return { error: "Enter a reason." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("umrah_booking_documents")
    .select("booking_id")
    .eq("id", documentId.data)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };

  const { error } = await supabase.rpc("review_umrah_document", {
    p_document_id: documentId.data,
    p_decision: decision.data,
    p_note: note || undefined,
  });
  if (error) return { error: error.message };

  if (decision.data === "rejected") void notifyUmrahBooking(doc.booking_id, "document_rejected", note);
  revalidateBooking(doc.booking_id);
  return { error: null };
}

const segmentSchema = z.object({
  bookingId: z.string().uuid(),
  segmentId: z.union([z.string().uuid(), z.literal("")]),
  kind: z.enum(["flight", "hotel", "transfer", "train"]),
  title: z.string().trim().min(1, "Enter a title.").max(120, "Keep the title under 120 characters."),
  provider: z.string().trim().max(80),
  reference: z.string().trim().max(60),
  city: z.union([z.enum(["makkah", "madinah", "jeddah", "other"]), z.literal("")]),
  startsAt: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Enter a valid start time."),
  endsAt: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Enter a valid end time."),
  notes: z.string().trim().max(500),
});

/** Flight/hotel/transfer rows for one booking. Times are wall clock, stored UTC-tagged like departures. */
export async function saveUmrahSegment(
  _prev: FulfillmentActionState,
  formData: FormData
): Promise<FulfillmentActionState> {
  const admin = await requirePlatformAdmin();
  const text = (key: string) => String(formData.get(key) ?? "");
  const parsed = segmentSchema.safeParse({
    bookingId: formData.get("bookingId"),
    segmentId: text("segmentId"),
    kind: formData.get("kind"),
    title: text("title"),
    provider: text("provider"),
    reference: text("reference"),
    city: text("city"),
    startsAt: text("startsAt"),
    endsAt: text("endsAt"),
    notes: text("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const startsAt = d.startsAt ? `${d.startsAt}:00Z` : null;
  const endsAt = d.endsAt ? `${d.endsAt}:00Z` : null;
  if (startsAt && endsAt && endsAt < startsAt) return { error: "End must be after the start." };

  const row = {
    booking_id: d.bookingId,
    kind: d.kind,
    title: d.title,
    provider: d.provider || null,
    reference: d.reference || null,
    city: d.city || null,
    starts_at: startsAt,
    ends_at: endsAt,
    notes: d.notes || null,
  };

  const supabase = await createClient();
  const { error } = d.segmentId
    ? await supabase.from("umrah_booking_segments").update(row).eq("id", d.segmentId).eq("booking_id", d.bookingId)
    : await supabase.from("umrah_booking_segments").insert({ ...row, created_by: admin.id });
  if (error) return { error: error.message };

  if (d.kind === "flight") void notifyUmrahBooking(d.bookingId, "flight_changed", d.title);
  revalidateBooking(d.bookingId);
  return { error: null };
}

export async function deleteUmrahSegment(
  _prev: FulfillmentActionState,
  formData: FormData
): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  const segmentId = z.string().uuid().safeParse(formData.get("segmentId"));
  if (!segmentId.success) return { error: "Invalid segment." };

  const supabase = await createClient();
  const { data: segment } = await supabase
    .from("umrah_booking_segments")
    .delete()
    .eq("id", segmentId.data)
    .select("booking_id")
    .maybeSingle();
  if (!segment) return { error: "Segment not found." };

  revalidateBooking(segment.booking_id);
  return { error: null };
}
