"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { apiUpload, getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";

export type PilgrimActionState = { error: string | null } | null;

function revalidateAll() {
  revalidatePath("/account/bookings", "layout");
  revalidatePath("/agent/bookings", "layout");
  revalidatePath("/admin/umrah/bookings", "layout");
  revalidatePath("/admin/umrah/departures", "layout");
}

/** Edits one pilgrim; the API decides who may edit and when. Never redirects, so it is safe from the agent desk. */
export async function updateUmrahPilgrim(_prev: PilgrimActionState, formData: FormData): Promise<PilgrimActionState> {
  await requireUser();
  const text = (key: string) => String(formData.get(key) ?? "");
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.pilgrims.update.mutate({
      pilgrimId: text("pilgrimId"),
      full_name: text("full_name"),
      gender: text("gender") as "male" | "female",
      date_of_birth: text("date_of_birth"),
      nationality: text("nationality"),
      passport_number: text("passport_number"),
      passport_expiry: text("passport_expiry"),
      passport_issue_country: text("passport_issue_country"),
      mahram_name: text("mahram_name"),
      mahram_relation: text("mahram_relation"),
      phone: text("phone"),
    });
  } catch (error) {
    return { error: trpcErrorMessage(error, "Could not update the pilgrim.") };
  }
  revalidateAll();
  return { error: null };
}

/** A traveller (or their agent) hands in a passport copy, photo or certificate for staff review. */
export async function uploadPilgrimDocument(_prev: PilgrimActionState, formData: FormData): Promise<PilgrimActionState> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };

  const body = new FormData();
  body.set("bookingId", String(formData.get("bookingId") ?? ""));
  body.set("pilgrimId", String(formData.get("pilgrimId") ?? ""));
  body.set("docType", String(formData.get("docType") ?? ""));
  body.set("file", file, file.name);
  const { error } = await apiUpload("/umrah/pilgrim-documents", body);
  if (error) return { error };
  revalidateAll();
  return { error: null };
}

/** A customer's own file can be withdrawn while it waits for review. */
export async function deletePilgrimDocument(_prev: PilgrimActionState, formData: FormData): Promise<PilgrimActionState> {
  await requireUser();
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.pilgrims.deleteDocument.mutate({ documentId: String(formData.get("documentId") ?? "") });
  } catch (error) {
    return { error: trpcErrorMessage(error, "This document can no longer be removed.") };
  }
  revalidateAll();
  return { error: null };
}
