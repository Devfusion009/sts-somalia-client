"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";
import { deskOrderPath } from "@/modules/orders/helpers";
import type { ActionState } from "@/lib/auth/actions";

function text(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length ? str : undefined;
}

/**
 * Form adapter for umrah.createGroupBooking: reads the booking and pilgrim
 * fields, the API validates, prices and books. Desk submissions get a path
 * back instead of a redirect (a redirect into the agent portal lands on the
 * wrong host).
 */
export async function createUmrahBooking(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?redirect_to=${encodeURIComponent("/umrah")}`);

  const numPilgrims = Number(formData.get("num_pilgrims"));
  if (!Number.isInteger(numPilgrims) || numPilgrims < 1) return { error: "At least one pilgrim is required." };
  const roomSharing = text(formData.get("room_sharing"));

  const pilgrims = Array.from({ length: numPilgrims }, (_, i) => ({
    full_name: String(formData.get(`pilgrim_${i}_full_name`) ?? ""),
    gender: String(formData.get(`pilgrim_${i}_gender`) ?? "") as "male" | "female",
    date_of_birth: text(formData.get(`pilgrim_${i}_date_of_birth`)),
    nationality: text(formData.get(`pilgrim_${i}_nationality`)),
    passport_number: text(formData.get(`pilgrim_${i}_passport_number`)),
    passport_expiry: text(formData.get(`pilgrim_${i}_passport_expiry`)),
    mahram_name: text(formData.get(`pilgrim_${i}_mahram_name`)),
    mahram_relation: text(formData.get(`pilgrim_${i}_mahram_relation`)),
  }));
  for (const [i, p] of pilgrims.entries()) {
    if (p.full_name.trim().length < 2) return { error: `Pilgrim ${i + 1}: Enter the pilgrim's full name.` };
    if (p.gender !== "male" && p.gender !== "female") return { error: `Pilgrim ${i + 1}: Choose a gender.` };
  }

  let orderId: string;
  try {
    const trpc = await getServerTrpcForActions();
    ({ orderId } = await trpc.umrah.createGroupBooking.mutate({
      departureId: String(formData.get("departure_id") ?? ""),
      numPilgrims,
      roomSharing: roomSharing ? Number(roomSharing) : undefined,
      specialRequests: text(formData.get("special_requests")),
      pilgrims,
      hold: formData.get("intent") === "hold",
      agencyCustomerId: text(formData.get("agencyCustomerId")),
      newCustomerName: text(formData.get("newCustomerName")),
      newCustomerPhone: text(formData.get("newCustomerPhone")),
    }));
  } catch (error) {
    return { error: trpcErrorMessage(error, "Could not create the booking.") };
  }

  // Only the agent desk form posts desk=1.
  if (formData.get("desk") === "1") {
    return { error: null, destination: deskOrderPath(orderId), orderId };
  }
  redirect(`/checkout/${orderId}`);
}
