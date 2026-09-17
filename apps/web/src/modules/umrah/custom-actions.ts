"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile, requireUser } from "@/lib/auth/session";
import { portalLoginHref } from "@/lib/subdomain";
import { createClient } from "@/lib/supabase/server";
import {
  assertAgencyCanBookProduct,
  createOrderForBooking,
  getActiveAgencyId,
} from "@/modules/orders/helpers";
import { resolveBookedForCustomer } from "@/modules/agencies/booked-for";
import { REQUEST_NOT_EDITABLE_ERROR } from "@/modules/umrah/custom-errors";
import { UMRAH_CATEGORIES, type UmrahService } from "@/modules/umrah/services";
import {
  isRoomSharing,
  priceSelection,
  toSharingPriceMap,
  unitPriceFor,
  type SharingPriceMap,
} from "@/modules/umrah/pricing";

export type ActionState = {
  error: string | null;
  /** Echoed back so a rejected step can refill its fields (React 19 resets
   *  uncontrolled inputs once the action returns). */
  values?: Record<string, string>;
} | null;

/**
 * Every wizard redirect goes through this so the builder can be hosted at
 * two base paths — the B2C marketing route and the agent desk — without the
 * two ever bleeding into each other. `desk` comes from a hidden form field
 * each step's `<form>` renders when it is mounted under the agent portal;
 * a plain B2C submission never sends it, so the default keeps the existing
 * marketing behaviour unchanged.
 */
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

/** RLS-scoped fetch that also proves "mine, and still editable". */
async function getEditableRequest(requestId: string, profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("umrah_custom_requests")
    .select("*")
    .eq("id", requestId)
    .eq("booked_by", profileId)
    .eq("status", "draft")
    .maybeSingle();
  return { supabase, request: data };
}

// ---------------------------------------------------------------------------
// Start / resume
// ---------------------------------------------------------------------------

/**
 * Opens the builder. An unfinished draft is RESUMED rather than replaced —
 * without this, every visit to /umrah/private would strand the previous
 * half-built trip somewhere the customer can no longer reach it, which is
 * exactly the bug the visa wizard already solved the same way.
 */
export async function startUmrahCustomRequest(formData: FormData): Promise<void> {
  const desk = isDesk(formData);
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(
      desk
        ? portalLoginHref("agent")
        : `/login?redirect_to=${encodeURIComponent(wizardBasePath(desk))}`
    );
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("umrah_custom_requests")
    .select("id, current_step")
    .eq("booked_by", profile.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Resume exactly where they left off, not step 1 — every earlier step's
  // data is already saved, so sending someone back through screens they've
  // already filled in just to reach the one they stopped on is the kind of
  // busywork a "resume" feature exists to remove.
  if (existing) redirect(wizardPath(existing.id, existing.current_step, desk));

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  const access = await assertAgencyCanBookProduct(supabase, agencyId, "umrah");
  if (!access.ok) redirect(desk ? "/agent/book/umrah" : "/umrah?blocked=1");

  const { data: created, error } = await supabase
    .from("umrah_custom_requests")
    .insert({
      customer_id: profile.id,
      booked_by: profile.id,
      agency_id: agencyId,
    })
    .select("id")
    .single();

  if (error || !created) redirect(`${wizardBasePath(desk)}?error=1`);
  redirect(wizardPath(created.id, 1, desk));
}

// ---------------------------------------------------------------------------
// Step 1 — travellers, dates, standard
// ---------------------------------------------------------------------------

const basicsSchema = z.object({
  tier: z.enum(["basic", "standard", "premium"]),
  num_pilgrims: z.coerce.number().int().min(1, "At least one traveller.").max(40, "For parties over 40, contact us directly — we'll arrange a group departure."),
  departure_date: z.string().min(1, "Choose a departure date."),
  nights_makkah: z.coerce.number().int().min(0).max(60, "Maximum 60 nights in one city."),
  nights_madinah: z.coerce.number().int().min(0).max(60, "Maximum 60 nights in one city."),
});

export async function saveUmrahTripBasics(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const requestId = String(formData.get("requestId"));
  const desk = isDesk(formData);

  const parsed = basicsSchema.safeParse({
    tier: formData.get("tier"),
    num_pilgrims: formData.get("num_pilgrims"),
    departure_date: formData.get("departure_date"),
    nights_makkah: formData.get("nights_makkah"),
    nights_madinah: formData.get("nights_madinah"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  const data = parsed.data;

  if (data.nights_makkah + data.nights_madinah === 0) {
    return { error: "Add at least one night in Makkah or Madinah.", values: formValues(formData) };
  }

  // Every traveller's name is captured here, next to the count that sets
  // it, rather than only three steps later at the pilgrim-details screen —
  // the party is who this whole trip is being priced and booked for, and a
  // name typed here survives into step 3 as a prefilled field instead of
  // being asked for twice.
  const travellerNames: string[] = [];
  for (let i = 0; i < data.num_pilgrims; i++) {
    const raw = formData.get(`traveller_name_${i}`);
    const name = typeof raw === "string" ? raw.trim() : "";
    if (name.length < 2) {
      return {
        error:
          i === 0
            ? "Enter the lead traveller's full name."
            : `Enter traveller ${i + 1}'s full name.`,
        values: formValues(formData),
      };
    }
    travellerNames.push(name);
  }

  const { supabase, request } = await getEditableRequest(requestId, profile.id);
  if (!request) return { error: REQUEST_NOT_EDITABLE_ERROR };

  // Merge onto whatever step 3 may already have saved for these travellers
  // (gender, passport, mahram) — this only ever touches full_name, so
  // revisiting step 1 to fix a typo never wipes out passport details typed
  // afterwards. A traveller added by raising the count starts with just a
  // name and the same "male" default step 3's form itself uses.
  const existingPilgrims: PilgrimInput[] = Array.isArray(request.pilgrims)
    ? (request.pilgrims as PilgrimInput[])
    : [];
  const pilgrims: PilgrimInput[] = travellerNames.map((full_name, i) => ({
    ...(existingPilgrims[i] ?? { gender: "male" as const }),
    full_name,
  }));

  const { error } = await supabase
    .from("umrah_custom_requests")
    .update({
      tier: data.tier,
      num_pilgrims: data.num_pilgrims,
      departure_date: data.departure_date,
      nights_makkah: data.nights_makkah,
      nights_madinah: data.nights_madinah,
      pilgrims,
      current_step: Math.max(request.current_step, 2),
    })
    .eq("id", requestId);
  if (error) return { error: error.message, values: formValues(formData) };

  // Changing the party size or the nights reprices every line that was already
  // chosen. Repricing here (rather than only at submit) is what keeps the
  // running total on the next screen honest after someone goes back and adds
  // a traveller.
  await repriceRequest(supabase, requestId);

  redirect(wizardPath(requestId, 2, desk));
}

// ---------------------------------------------------------------------------
// Step 2 — the services themselves
// ---------------------------------------------------------------------------

export async function saveUmrahTripServices(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const requestId = String(formData.get("requestId"));
  const desk = isDesk(formData);

  const { supabase, request } = await getEditableRequest(requestId, profile.id);
  if (!request) return { error: REQUEST_NOT_EDITABLE_ERROR };

  const roomSharing = Number(formData.get("room_sharing"));
  if (!isRoomSharing(roomSharing)) return { error: "Choose a room type." };

  const serviceIds = formData
    .getAll("service_id")
    .map(String)
    .filter((id) => z.string().uuid().safeParse(id).success);

  // Prices are re-read from the catalog, never taken from the form. The
  // browser sends ids; what those ids cost is the server's business.
  const { data: rows } = await supabase
    .from("umrah_services")
    .select(
      "id, category, name, description, tier, price, currency, price_unit, star_rating, distance_to_haram_m, is_default, sort_order"
    )
    .in("id", serviceIds.length ? serviceIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "published");

  const services: UmrahService[] = (rows ?? []).map((s) => ({ ...s, price: Number(s.price) }));

  // One choice per single-select category, whatever the form posted. The DB
  // has the same rule as a partial unique index; this turns it into a
  // readable message instead of a constraint violation.
  for (const category of UMRAH_CATEGORIES) {
    if (category.selection !== "single") continue;
    if (services.filter((s) => s.category === category.value).length > 1) {
      return { error: `Choose only one option for ${category.label}.` };
    }
  }

  const missing = UMRAH_CATEGORIES.filter((c) => {
    if (!c.requiredWhen) return false;
    const nights = c.requiredWhen === "nights_makkah" ? request.nights_makkah : request.nights_madinah;
    return nights > 0 && !services.some((s) => s.category === c.value);
  });
  if (missing.length) {
    return { error: `Choose a ${missing[0].label.toLowerCase()} — you have nights booked in that city.` };
  }

  const trip = {
    numPilgrims: request.num_pilgrims,
    nightsMakkah: request.nights_makkah,
    nightsMadinah: request.nights_madinah,
  };
  const sharingPrices = await loadSharingPrices(
    supabase,
    services.map((s) => s.id)
  );
  const { lines, total } = priceSelection(services, trip, { roomSharing, sharingPrices });

  // Replace wholesale rather than diffing: the selection IS the state, and a
  // partial update is how a deselected line survives into the total.
  const { error: deleteError } = await supabase
    .from("umrah_custom_request_services")
    .delete()
    .eq("request_id", requestId);
  if (deleteError) return { error: deleteError.message };

  if (lines.length) {
    const { error: insertError } = await supabase.from("umrah_custom_request_services").insert(
      lines.map((line) => ({
        request_id: requestId,
        service_id: line.serviceId,
        category: line.category,
        name: line.name,
        price_unit: line.priceUnit,
        unit_price: line.unitPrice,
        quantity: line.quantity,
        line_total: line.lineTotal,
      }))
    );
    if (insertError) return { error: insertError.message };
  }

  const { error: updateError } = await supabase
    .from("umrah_custom_requests")
    .update({
      subtotal: total,
      room_sharing: roomSharing,
      currency: services[0]?.currency ?? request.currency,
      current_step: Math.max(request.current_step, 3),
    })
    .eq("id", requestId);
  if (updateError) return { error: updateError.message };

  redirect(wizardPath(requestId, 3, desk));
}

// ---------------------------------------------------------------------------
// Step 3 — pilgrim details
// ---------------------------------------------------------------------------

const pilgrimSchema = z.object({
  full_name: z.string().min(2, "Enter the traveller's full name."),
  gender: z.enum(["male", "female"]),
  date_of_birth: z.string().optional(),
  nationality: z.string().optional(),
  passport_number: z.string().optional(),
  passport_expiry: z.string().optional(),
  mahram_name: z.string().optional(),
  mahram_relation: z.string().optional(),
});

export type PilgrimInput = z.infer<typeof pilgrimSchema>;

function emptyToUndefined(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  return str.length ? str : undefined;
}

export async function saveUmrahTripPilgrims(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const requestId = String(formData.get("requestId"));
  const desk = isDesk(formData);

  const { supabase, request } = await getEditableRequest(requestId, profile.id);
  if (!request) return { error: REQUEST_NOT_EDITABLE_ERROR };

  const pilgrims: PilgrimInput[] = [];
  for (let i = 0; i < request.num_pilgrims; i++) {
    const parsed = pilgrimSchema.safeParse({
      full_name: formData.get(`pilgrim_${i}_full_name`),
      gender: formData.get(`pilgrim_${i}_gender`),
      date_of_birth: emptyToUndefined(formData.get(`pilgrim_${i}_date_of_birth`)),
      nationality: emptyToUndefined(formData.get(`pilgrim_${i}_nationality`)),
      passport_number: emptyToUndefined(formData.get(`pilgrim_${i}_passport_number`)),
      passport_expiry: emptyToUndefined(formData.get(`pilgrim_${i}_passport_expiry`)),
      mahram_name: emptyToUndefined(formData.get(`pilgrim_${i}_mahram_name`)),
      mahram_relation: emptyToUndefined(formData.get(`pilgrim_${i}_mahram_relation`)),
    });
    if (!parsed.success) {
      return {
        error: `Traveller ${i + 1}: ${parsed.error.issues[0].message}`,
        values: formValues(formData),
      };
    }
    pilgrims.push(parsed.data);
  }

  const { error } = await supabase
    .from("umrah_custom_requests")
    .update({
      pilgrims,
      notes: emptyToUndefined(formData.get("notes")) ?? null,
      current_step: Math.max(request.current_step, 4),
    })
    .eq("id", requestId);
  if (error) return { error: error.message, values: formValues(formData) };

  redirect(wizardPath(requestId, 4, desk));
}

// ---------------------------------------------------------------------------
// Step 4 — submit
// ---------------------------------------------------------------------------

/**
 * Turns the finished build into a real Umrah booking plus an order.
 *
 * The order is created UNPAID and the customer is sent to their booking
 * tracker rather than straight to checkout, because a private trip is quoted
 * against dates STS has not yet held: the hotels, seats and visa slots are
 * confirmed by a human first, and only then does the customer pay. That is
 * the same pay-after-confirmation loop the manual hotel and hall bookings
 * already run through /admin/queue — the price shown here is firm, it is the
 * availability that still needs a person.
 */
export async function submitUmrahCustomRequest(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const requestId = String(formData.get("requestId"));
  const desk = isDesk(formData);

  const { supabase, request } = await getEditableRequest(requestId, profile.id);
  if (!request) return { error: REQUEST_NOT_EDITABLE_ERROR };

  if (!request.departure_date) return { error: "Go back to step 1 and choose a departure date." };

  const { data: lineRows } = await supabase
    .from("umrah_custom_request_services")
    .select("service_id")
    .eq("request_id", requestId);
  if (!lineRows?.length) return { error: "Go back to step 2 and choose at least one service." };

  // Reprice from the live catalog one last time before money is involved: the
  // draft may have sat for days, and what gets charged has to be what the
  // catalog says today, recomputed server-side.
  const total = await repriceRequest(supabase, requestId);
  if (total === null) return { error: "Could not price this trip. Please review your selections." };
  if (total <= 0) return { error: "This trip has no priced services yet." };

  const pilgrims = Array.isArray(request.pilgrims) ? (request.pilgrims as PilgrimInput[]) : [];
  if (pilgrims.length !== request.num_pilgrims) {
    return { error: "Go back to step 3 and complete every traveller's details." };
  }

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  const access = await assertAgencyCanBookProduct(supabase, agencyId, "umrah");
  if (!access.ok) return { error: access.message };
  const agencyCustomerId = await resolveBookedForCustomer(supabase, agencyId, formData);

  const { data: booking, error: bookingError } = await supabase
    .from("umrah_bookings")
    .insert({
      booking_kind: "private",
      custom_request_id: requestId,
      customer_id: profile.id,
      booked_by: profile.id,
      agency_id: agencyId,
      num_pilgrims: request.num_pilgrims,
      room_sharing: request.room_sharing,
      total_price: total,
      currency: request.currency,
      special_requests: request.notes,
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    return { error: bookingError?.message ?? "Could not create the booking." };
  }

  const { error: pilgrimsError } = await supabase.from("umrah_pilgrims").insert(
    pilgrims.map((p) => ({
      booking_id: booking.id,
      full_name: p.full_name,
      gender: p.gender,
      date_of_birth: p.date_of_birth ?? null,
      nationality: p.nationality ?? null,
      passport_number: p.passport_number ?? null,
      passport_expiry: p.passport_expiry ?? null,
      mahram_name: p.mahram_name ?? null,
      mahram_relation: p.mahram_relation ?? null,
    }))
  );
  if (pilgrimsError) return { error: pilgrimsError.message };

  let order;
  try {
    order = await createOrderForBooking(supabase, {
      customerId: profile.id,
      bookedBy: profile.id,
      agencyId,
      agencyCustomerId,
      currency: request.currency,
      itemType: "umrah",
      price: total,
      umrahBookingId: booking.id,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the order." };
  }

  // Locking the request comes last: while it is still 'draft' the customer's
  // RLS grant lets them edit it, and every write above depends on that.
  await supabase
    .from("umrah_custom_requests")
    .update({ status: "submitted", subtotal: total })
    .eq("id", requestId);

  redirect(desk ? `/agent/bookings/${order.id}` : `/account/bookings/${order.id}?requested=1`);
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

type Client = Awaited<ReturnType<typeof createClient>>;

/** Occupancy prices for these services, as the pure pricing engine takes them. */
async function loadSharingPrices(supabase: Client, serviceIds: string[]): Promise<SharingPriceMap> {
  if (serviceIds.length === 0) return {};
  const { data } = await supabase
    .from("umrah_service_sharing_prices")
    .select("service_id, sharing, price")
    .in("service_id", serviceIds);
  return toSharingPriceMap(data ?? []);
}

/**
 * Recomputes every stored line from the live catalog and the request's current
 * party size / nights, and writes back the subtotal. Returns the new subtotal,
 * or null if the request could not be read.
 *
 * A line whose service was deleted from the catalog keeps its snapshotted
 * price rather than vanishing — the customer chose it and was quoted it, and
 * silently dropping a line would change the total behind their back.
 */
async function repriceRequest(supabase: Client, requestId: string): Promise<number | null> {
  const { data: request } = await supabase
    .from("umrah_custom_requests")
    .select("num_pilgrims, nights_makkah, nights_madinah, room_sharing")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return null;

  const { data: lines } = await supabase
    .from("umrah_custom_request_services")
    .select("id, service_id, category, name, price_unit, unit_price, service:umrah_services(price, name, status)")
    .eq("request_id", requestId);

  const trip = {
    numPilgrims: request.num_pilgrims,
    nightsMakkah: request.nights_makkah,
    nightsMadinah: request.nights_madinah,
  };
  const sharing = {
    roomSharing: isRoomSharing(request.room_sharing) ? request.room_sharing : 4,
    sharingPrices: await loadSharingPrices(
      supabase,
      (lines ?? []).map((l) => l.service_id).filter((id): id is string => id !== null)
    ),
  } as const;

  const priced = (lines ?? []).map((line) => {
    const live = line.service as { price: number; name: string; status: string } | null;
    // A live, published service is priced for the request's room type; a
    // withdrawn one keeps its snapshotted unit price as-is.
    const unitPrice =
      live && live.status === "published" && line.service_id
        ? unitPriceFor({ id: line.service_id, category: line.category, price: Number(live.price) }, sharing)
        : Number(line.unit_price);
    const { lines: [computed] } = priceSelection(
      [
        {
          id: line.service_id ?? line.id,
          category: line.category,
          name: live?.name ?? line.name,
          description: null,
          tier: null,
          price: unitPrice,
          currency: "USD",
          price_unit: line.price_unit,
          star_rating: null,
          distance_to_haram_m: null,
          is_default: false,
          sort_order: 0,
        },
      ],
      trip
    );
    return { id: line.id, computed };
  });

  let subtotal = 0;
  for (const { id, computed } of priced) {
    if (!computed) {
      // Quantity fell to zero (e.g. the city's nights are now 0). The line no
      // longer applies to this trip, so it goes.
      await supabase.from("umrah_custom_request_services").delete().eq("id", id);
      continue;
    }
    subtotal += computed.lineTotal;
    await supabase
      .from("umrah_custom_request_services")
      .update({
        name: computed.name,
        unit_price: computed.unitPrice,
        quantity: computed.quantity,
        line_total: computed.lineTotal,
      })
      .eq("id", id);
  }

  await supabase.from("umrah_custom_requests").update({ subtotal }).eq("id", requestId);
  return subtotal;
}

/** Abandon a draft build. */
export async function discardUmrahCustomRequest(formData: FormData): Promise<void> {
  const profile = await requireUser();
  const requestId = String(formData.get("requestId"));
  const desk = isDesk(formData);
  const supabase = await createClient();
  await supabase
    .from("umrah_custom_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("booked_by", profile.id)
    .eq("status", "draft");

  revalidatePath(wizardBasePath(desk));
  redirect(desk ? "/agent/book/umrah" : "/umrah");
}
