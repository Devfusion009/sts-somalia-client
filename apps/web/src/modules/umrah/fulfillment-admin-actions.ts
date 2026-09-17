"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";

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
  revalidatePath("/account/bookings", "layout");
}

/** Maps the stage RPC's raise messages to one plain line. */
function stageErrorMessage(message: string) {
  if (message.includes("has not been paid")) return "This booking has not been paid yet.";
  if (message.includes("cannot move back")) return "Stages can only move forward.";
  if (message.includes("not found")) return "Booking not found.";
  const status = message.match(/this booking is (\w+)/);
  if (status) return `This booking is ${status[1]}.`;
  if (message.includes("only STS staff")) return "Only STS staff can change the stage.";
  return message.charAt(0).toUpperCase() + message.slice(1);
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
