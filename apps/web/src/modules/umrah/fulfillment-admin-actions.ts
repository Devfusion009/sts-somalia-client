"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { apiUpload, getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";

export type FulfillmentActionState = { error: string | null } | null;

function revalidateBooking(bookingId: string) {
  revalidatePath("/admin/umrah/bookings");
  revalidatePath(`/admin/umrah/bookings/${bookingId}`);
  revalidatePath("/admin/umrah/departures", "layout");
  revalidatePath("/account/bookings", "layout");
  revalidatePath("/agent/bookings", "layout");
}

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function run(bookingId: string, call: () => Promise<unknown>, fallback: string): Promise<FulfillmentActionState> {
  try {
    await call();
  } catch (error) {
    return { error: trpcErrorMessage(error, fallback) };
  }
  if (bookingId) revalidateBooking(bookingId);
  return { error: null };
}

export async function advanceUmrahStage(_prev: FulfillmentActionState, formData: FormData): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  const bookingId = str(formData, "bookingId");
  return run(
    bookingId,
    async () =>
      (await getServerTrpcForActions()).umrah.admin.bookings.advanceStage.mutate({
        bookingId,
        stage: str(formData, "stage") as "confirmed",
        note: str(formData, "note") || undefined,
      }),
    "The stage could not be changed."
  );
}

/** Staff attach a travel document; the file goes to the API as multipart. */
export async function uploadUmrahDocument(_prev: FulfillmentActionState, formData: FormData): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  const bookingId = str(formData, "bookingId");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  const body = new FormData();
  body.set("bookingId", bookingId);
  body.set("docType", str(formData, "docType"));
  body.set("title", str(formData, "title"));
  body.set("pilgrimId", str(formData, "pilgrimId"));
  body.set("file", file, file.name);
  const { error } = await apiUpload("/umrah/documents", body);
  if (error) return { error };
  revalidateBooking(bookingId);
  return { error: null };
}

export async function deleteUmrahDocument(_prev: FulfillmentActionState, formData: FormData): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  try {
    const { bookingId } = await (await getServerTrpcForActions()).umrah.admin.bookings.deleteDocument.mutate({
      documentId: str(formData, "documentId"),
    });
    revalidateBooking(bookingId);
    return { error: null };
  } catch (error) {
    return { error: trpcErrorMessage(error, "The document could not be removed.") };
  }
}

/** Unpaid: the order is cancelled. Paid: an approved cancellation for the amount entered goes to refunds. */
export async function cancelUmrahBooking(_prev: FulfillmentActionState, formData: FormData): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  const bookingId = str(formData, "bookingId");
  const amount = str(formData, "refundAmount");
  const result = await run(
    bookingId,
    async () =>
      (await getServerTrpcForActions()).umrah.admin.bookings.cancel.mutate({
        bookingId,
        reason: str(formData, "reason"),
        refundAmount: amount ? Number(amount) : undefined,
      }),
    "The booking could not be cancelled."
  );
  if (!result?.error) revalidatePath("/admin/refunds");
  return result;
}

export async function reviewUmrahDocument(_prev: FulfillmentActionState, formData: FormData): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  try {
    const { bookingId } = await (await getServerTrpcForActions()).umrah.admin.bookings.reviewDocument.mutate({
      documentId: str(formData, "documentId"),
      decision: str(formData, "decision") as "accepted" | "rejected",
      note: str(formData, "note").slice(0, 500) || undefined,
    });
    revalidateBooking(bookingId);
    return { error: null };
  } catch (error) {
    return { error: trpcErrorMessage(error, "The review could not be saved.") };
  }
}

/** Flight/hotel/transfer rows for one booking. */
export async function saveUmrahSegment(_prev: FulfillmentActionState, formData: FormData): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  const bookingId = str(formData, "bookingId");
  return run(
    bookingId,
    async () =>
      (await getServerTrpcForActions()).umrah.admin.bookings.saveSegment.mutate({
        bookingId,
        segmentId: str(formData, "segmentId") || undefined,
        kind: str(formData, "kind") as "flight",
        title: str(formData, "title"),
        provider: str(formData, "provider") || undefined,
        reference: str(formData, "reference") || undefined,
        city: (str(formData, "city") || null) as "makkah" | null,
        startsAt: str(formData, "startsAt") || null,
        endsAt: str(formData, "endsAt") || null,
        notes: str(formData, "notes") || undefined,
      }),
    "The travel detail could not be saved."
  );
}

export async function deleteUmrahSegment(_prev: FulfillmentActionState, formData: FormData): Promise<FulfillmentActionState> {
  await requirePlatformAdmin();
  try {
    const { bookingId } = await (await getServerTrpcForActions()).umrah.admin.bookings.deleteSegment.mutate({
      segmentId: str(formData, "segmentId"),
    });
    revalidateBooking(bookingId);
    return { error: null };
  } catch (error) {
    return { error: trpcErrorMessage(error, "The travel detail could not be removed.") };
  }
}
