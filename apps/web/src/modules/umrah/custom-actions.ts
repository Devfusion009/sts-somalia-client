"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { portalLoginHref } from "@/lib/subdomain";
import { getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";

/**
 * Form adapters for the private Umrah builder. Each step posts its fields to
 * the API (which validates, prices from the live catalog and saves) and then
 * moves the wizard on. The wizard runs under two base paths — the public
 * builder and the agent desk — chosen by the hidden `desk` field.
 */
export type ActionState = {
  error: string | null;
  /** Echoed back so a rejected step can refill its fields (React 19 resets uncontrolled inputs). */
  values?: Record<string, string>;
} | null;

export type PilgrimInput = {
  full_name: string;
  gender: "male" | "female";
  date_of_birth?: string;
  nationality?: string;
  passport_number?: string;
  passport_expiry?: string;
  mahram_name?: string;
  mahram_relation?: string;
};

function wizardBasePath(desk: boolean): string {
  return desk ? "/agent/book/umrah/private" : "/umrah/private";
}

function wizardPath(requestId: string, step: number, desk = false) {
  return `${wizardBasePath(desk)}/${requestId}?step=${step}`;
}

function isDesk(formData: FormData): boolean {
  return formData.get("desk") === "1";
}

function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "requestId") out[key] = value;
  }
  return out;
}

function text(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length ? str : undefined;
}

/** Opens the builder, resuming an unfinished draft at the step it stopped on. */
export async function startUmrahCustomRequest(formData: FormData): Promise<void> {
  const desk = isDesk(formData);
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(desk ? portalLoginHref("agent") : `/login?redirect_to=${encodeURIComponent(wizardBasePath(desk))}`);
  }

  let target: string;
  try {
    const trpc = await getServerTrpcForActions();
    const result = await trpc.umrah.trip.start.mutate();
    target =
      result.kind === "blocked"
        ? desk
          ? "/agent/book/umrah"
          : "/umrah?blocked=1"
        : wizardPath(result.requestId, result.step, desk);
  } catch {
    target = `${wizardBasePath(desk)}?error=1`;
  }
  redirect(target);
}

/** Step 1 — travellers, dates, standard. */
export async function saveUmrahTripBasics(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const requestId = String(formData.get("requestId"));
  const numPilgrims = Number(formData.get("num_pilgrims"));
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.trip.saveBasics.mutate({
      requestId,
      tier: String(formData.get("tier")) as "basic" | "standard" | "premium",
      numPilgrims,
      departureDate: String(formData.get("departure_date") ?? ""),
      nightsMakkah: Number(formData.get("nights_makkah")),
      nightsMadinah: Number(formData.get("nights_madinah")),
      travellerNames: Array.from({ length: Number.isInteger(numPilgrims) && numPilgrims > 0 ? numPilgrims : 0 }, (_, i) =>
        String(formData.get(`traveller_name_${i}`) ?? "")
      ),
    });
  } catch (error) {
    return { error: trpcErrorMessage(error, "Your trip could not be saved."), values: formValues(formData) };
  }
  redirect(wizardPath(requestId, 2, isDesk(formData)));
}

/** Step 2 — the services; prices come from the catalog, never the form. */
export async function saveUmrahTripServices(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const requestId = String(formData.get("requestId"));
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.trip.saveServices.mutate({
      requestId,
      roomSharing: Number(formData.get("room_sharing")),
      serviceIds: formData.getAll("service_id").map(String),
    });
  } catch (error) {
    return { error: trpcErrorMessage(error, "Your services could not be saved.") };
  }
  redirect(wizardPath(requestId, 3, isDesk(formData)));
}

/** Step 3 — traveller details. */
export async function saveUmrahTripPilgrims(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const requestId = String(formData.get("requestId"));
  const indexes = new Set<number>();
  for (const key of formData.keys()) {
    const match = key.match(/^pilgrim_(\d+)_/);
    if (match) indexes.add(Number(match[1]));
  }
  const count = indexes.size ? Math.max(...indexes) + 1 : 0;
  const pilgrims = Array.from({ length: count }, (_, i) => ({
    full_name: String(formData.get(`pilgrim_${i}_full_name`) ?? ""),
    gender: formData.get(`pilgrim_${i}_gender`),
    date_of_birth: text(formData.get(`pilgrim_${i}_date_of_birth`)),
    nationality: text(formData.get(`pilgrim_${i}_nationality`)),
    passport_number: text(formData.get(`pilgrim_${i}_passport_number`)),
    passport_expiry: text(formData.get(`pilgrim_${i}_passport_expiry`)),
    mahram_name: text(formData.get(`pilgrim_${i}_mahram_name`)),
    mahram_relation: text(formData.get(`pilgrim_${i}_mahram_relation`)),
  }));
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.trip.savePilgrims.mutate({ requestId, pilgrims, notes: text(formData.get("notes")) });
  } catch (error) {
    return { error: trpcErrorMessage(error, "Traveller details could not be saved."), values: formValues(formData) };
  }
  redirect(wizardPath(requestId, 4, isDesk(formData)));
}

/**
 * Step 4 — the trip becomes a booking plus an unpaid order; the customer pays
 * once STS confirms availability, from their booking tracker.
 */
export async function submitUmrahCustomRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const desk = isDesk(formData);
  let orderId: string;
  try {
    const trpc = await getServerTrpcForActions();
    ({ orderId } = await trpc.umrah.trip.submit.mutate({
      requestId: String(formData.get("requestId")),
      agencyCustomerId: text(formData.get("agencyCustomerId")),
      newCustomerName: text(formData.get("newCustomerName")),
      newCustomerPhone: text(formData.get("newCustomerPhone")),
    }));
  } catch (error) {
    return { error: trpcErrorMessage(error, "Could not submit this trip.") };
  }
  redirect(desk ? `/agent/bookings/${orderId}` : `/account/bookings/${orderId}?requested=1`);
}

/** Abandon a draft build. */
export async function discardUmrahCustomRequest(formData: FormData): Promise<void> {
  await requireUser();
  const desk = isDesk(formData);
  try {
    const trpc = await getServerTrpcForActions();
    await trpc.umrah.trip.discard.mutate({ requestId: String(formData.get("requestId")) });
  } catch {
    // Already submitted or discarded: nothing left to discard.
  }
  revalidatePath(wizardBasePath(desk));
  redirect(desk ? "/agent/book/umrah" : "/umrah");
}
