import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import {
  REQUEST_NOT_EDITABLE_ERROR,
  customRequestSchema,
  draftRequestSchema,
  UMRAH_CATEGORIES,
  isRoomSharing,
  pilgrimDetailsSchema,
  priceSelection,
  privateDepartureLeadError,
  unitPriceFor,
  type OrderResult,
  type PilgrimDetails,
  type StartTripResult,
  type SubmitTripInput,
  type TripBasicsInput,
  type TripPilgrimsInput,
  type TripServicesInput,
} from "@sts/shared-types";
import { OrdersService } from "../../orders/orders.service";
import { CustomRequestRepository } from "../repositories/custom-request.repository";
import { ServiceCatalogRepository } from "../repositories/service-catalog.repository";
import { UmrahBookingRepository } from "../repositories/umrah-booking.repository";
import { UmrahSettingsRepository } from "../repositories/umrah-settings.repository";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * The private Umrah builder: a draft request the customer prices step by
 * step, then submits as a booking plus an unpaid order. Prices are always
 * recomputed from the live catalog here, never taken from the browser. The
 * order stays unpaid until STS confirms availability.
 */
@Injectable()
export class PrivateTripService {
  constructor(
    private readonly requests: CustomRequestRepository,
    private readonly catalog: ServiceCatalogRepository,
    private readonly bookings: UmrahBookingRepository,
    private readonly settings: UmrahSettingsRepository,
    private readonly orders: OrdersService
  ) {}

  private async editable(requestId: string, userId: string): Promise<Row> {
    const request = await this.requests.findEditable(requestId, userId);
    if (!request) throw new BadRequestException(REQUEST_NOT_EDITABLE_ERROR);
    return request;
  }

  private async leadError(departureDate: string) {
    const { privateLeadDays } = await this.settings.getOperations();
    return privateDepartureLeadError(departureDate, privateLeadDays);
  }

  async myDraft(userId: string) {
    return draftRequestSchema.nullable().parse(await this.requests.findLatestDraft(userId));
  }

  async get(requestId: string) {
    return customRequestSchema.nullable().parse(await this.requests.findOne(requestId));
  }

  /** Resumes an unfinished draft at the step it stopped on, or opens a new one. */
  async start(userId: string): Promise<StartTripResult> {
    const existing = await this.requests.findLatestDraft(userId);
    if (existing) return { kind: "resume", requestId: existing.id, step: existing.current_step };
    const agencyId = await this.orders.getActiveAgencyId(userId);
    const access = await this.orders.assertAgencyCanBookProduct(agencyId, "umrah");
    if (!access.ok) return { kind: "blocked", message: access.message };
    const requestId = await this.requests.create({ customer_id: userId, booked_by: userId, agency_id: agencyId });
    return { kind: "created", requestId, step: 1 };
  }

  /** Step 1. Names typed here prefill step 3; anything step 3 saved for a traveller is kept. */
  async saveBasics(userId: string, input: TripBasicsInput) {
    if (input.nightsMakkah + input.nightsMadinah === 0) {
      throw new BadRequestException("Add at least one night in Makkah or Madinah.");
    }
    const lead = await this.leadError(input.departureDate);
    if (lead) throw new BadRequestException(lead);

    const names = input.travellerNames.slice(0, input.numPilgrims).map((n) => n.trim());
    for (let i = 0; i < input.numPilgrims; i++) {
      if ((names[i] ?? "").length < 2) {
        throw new BadRequestException(i === 0 ? "Enter the lead traveller's full name." : `Enter traveller ${i + 1}'s full name.`);
      }
    }

    const request = await this.editable(input.requestId, userId);
    const existing: Row[] = Array.isArray(request.pilgrims) ? request.pilgrims : [];
    await this.requests.update(input.requestId, {
      tier: input.tier,
      num_pilgrims: input.numPilgrims,
      departure_date: input.departureDate,
      nights_makkah: input.nightsMakkah,
      nights_madinah: input.nightsMadinah,
      pilgrims: names.map((full_name, i) => ({ ...(existing[i] ?? { gender: "male" }), full_name })),
      // A smaller party cannot keep a room sized for more guests than travel.
      room_sharing: Math.min(Number(request.room_sharing) || 4, Math.max(1, Math.min(4, input.numPilgrims))),
      current_step: Math.max(request.current_step, 2),
    });
    // Party size and nights reprice every line already chosen.
    await this.reprice(input.requestId);
    return { step: 2 };
  }

  /** Step 2. One choice per single-select category; required hotels for every city with nights. */
  async saveServices(userId: string, input: TripServicesInput) {
    const request = await this.editable(input.requestId, userId);
    if (!isRoomSharing(input.roomSharing)) throw new BadRequestException("Choose a room type.");
    if (input.roomSharing > request.num_pilgrims) {
      throw new BadRequestException("Choose a room type for your party size.");
    }

    const ids = input.serviceIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    const services = await this.catalog.findPublishedByIds(ids);

    for (const category of UMRAH_CATEGORIES) {
      if (category.selection === "single" && services.filter((s) => s.category === category.value).length > 1) {
        throw new BadRequestException(`Choose only one option for ${category.label}.`);
      }
    }
    const missing = UMRAH_CATEGORIES.find((c) => {
      if (!c.requiredWhen) return false;
      const nights = c.requiredWhen === "nights_makkah" ? request.nights_makkah : request.nights_madinah;
      return nights > 0 && !services.some((s) => s.category === c.value);
    });
    if (missing) throw new BadRequestException(`Choose a ${missing.label.toLowerCase()} — you have nights booked in that city.`);

    const trip = { numPilgrims: request.num_pilgrims, nightsMakkah: request.nights_makkah, nightsMadinah: request.nights_madinah };
    const sharingPrices = await this.catalog.findSharingPrices(services.map((s) => s.id));
    const { lines, total } = priceSelection(services, trip, { roomSharing: input.roomSharing, sharingPrices });

    await this.requests.replaceLines(
      input.requestId,
      lines.map((l) => ({
        service_id: l.serviceId,
        category: l.category,
        name: l.name,
        price_unit: l.priceUnit,
        unit_price: l.unitPrice,
        quantity: l.quantity,
        line_total: l.lineTotal,
      }))
    );
    await this.requests.update(input.requestId, {
      subtotal: total,
      room_sharing: input.roomSharing,
      currency: services[0]?.currency ?? request.currency,
      current_step: Math.max(request.current_step, 3),
    });
    return { step: 3 };
  }

  /** Step 3. Each traveller validated on its own, so the message names who is incomplete. */
  async savePilgrims(userId: string, input: TripPilgrimsInput) {
    const request = await this.editable(input.requestId, userId);
    const pilgrims: PilgrimDetails[] = [];
    for (let i = 0; i < request.num_pilgrims; i++) {
      const parsed = pilgrimDetailsSchema.safeParse(input.pilgrims[i] ?? {});
      if (!parsed.success) throw new BadRequestException(`Traveller ${i + 1}: ${parsed.error.issues[0].message}`);
      pilgrims.push(parsed.data);
    }
    await this.requests.update(input.requestId, {
      pilgrims,
      notes: input.notes?.trim() || null,
      current_step: Math.max(request.current_step, 4),
    });
    return { step: 4 };
  }

  /** Step 4. A firm price from today's catalog, a booking, its pilgrims and an unpaid order. */
  async submit(userId: string, input: SubmitTripInput): Promise<OrderResult> {
    const request = await this.editable(input.requestId, userId);
    if (!request.departure_date) throw new BadRequestException("Go back to step 1 and choose a departure date.");
    const lead = await this.leadError(request.departure_date);
    if (lead) throw new BadRequestException(`${lead} Go back to step 1 to change it.`);
    if ((await this.requests.findLines(input.requestId)).length === 0) {
      throw new BadRequestException("Go back to step 2 and choose at least one service.");
    }

    const total = await this.reprice(input.requestId);
    if (total === null) throw new BadRequestException("Could not price this trip. Please review your selections.");
    if (total <= 0) throw new BadRequestException("This trip has no priced services yet.");

    const pilgrims: PilgrimDetails[] = Array.isArray(request.pilgrims) ? request.pilgrims : [];
    if (pilgrims.length !== request.num_pilgrims) {
      throw new BadRequestException("Go back to step 3 and complete every traveller's details.");
    }

    const agencyId = await this.orders.getActiveAgencyId(userId);
    const access = await this.orders.assertAgencyCanBookProduct(agencyId, "umrah");
    if (!access.ok) throw new BadRequestException(access.message);
    const agencyCustomerId = await this.orders.resolveBookedForCustomer(agencyId, input);

    const { id: bookingId, error } = await this.bookings.insertPrivateBooking({
      booking_kind: "private",
      custom_request_id: input.requestId,
      customer_id: userId,
      booked_by: userId,
      agency_id: agencyId,
      num_pilgrims: request.num_pilgrims,
      room_sharing: request.room_sharing,
      total_price: total,
      currency: request.currency,
      special_requests: request.notes,
    });
    // One live booking per request (unique index): a double submit stops here.
    if (error?.code === "23505") throw new ConflictException("This trip was already submitted.");
    if (error || !bookingId) throw new BadRequestException("Could not create the booking.");

    const pilgrimError = await this.bookings.insertPilgrims(
      bookingId,
      pilgrims.map((p) => ({
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
    if (pilgrimError) {
      await this.bookings.delete(bookingId);
      throw new BadRequestException("Traveller details could not be saved.");
    }

    let orderId: string;
    try {
      const order = await this.orders.createForBooking({
        customerId: userId,
        bookedBy: userId,
        agencyId,
        agencyCustomerId,
        currency: request.currency,
        itemType: "umrah",
        price: total,
        umrahBookingId: bookingId,
      });
      orderId = order.id;
    } catch {
      await this.bookings.delete(bookingId);
      throw new BadRequestException("Could not create the order.");
    }

    // Locking comes last: while still 'draft' the customer's RLS grant allows the writes above.
    await this.requests.update(input.requestId, { status: "submitted", subtotal: total });
    return { orderId };
  }

  discard(userId: string, requestId: string) {
    return this.requests.discard(requestId, userId);
  }

  /**
   * Recomputes every stored line from the live catalog and the request's
   * party size / nights and writes back the subtotal. A line whose service
   * left the catalog keeps its quoted unit price; a line whose quantity fell
   * to zero goes.
   */
  private async reprice(requestId: string): Promise<number | null> {
    const request = await this.requests.findOne(requestId);
    if (!request) return null;
    const lines = await this.requests.findLines(requestId);
    const trip = { numPilgrims: request.num_pilgrims, nightsMakkah: request.nights_makkah, nightsMadinah: request.nights_madinah };
    const sharing = {
      roomSharing: isRoomSharing(request.room_sharing) ? request.room_sharing : 4,
      sharingPrices: await this.catalog.findSharingPrices(lines.map((l) => l.service_id).filter((id): id is string => !!id)),
    } as const;

    let subtotal = 0;
    for (const line of lines) {
      const live = line.service as { price: number; name: string; status: string } | null;
      const unitPrice =
        live && live.status === "published" && line.service_id
          ? unitPriceFor({ id: line.service_id, category: line.category, price: Number(live.price) }, sharing)
          : Number(line.unit_price);
      const {
        lines: [computed],
      } = priceSelection(
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
      if (!computed) {
        await this.requests.deleteLine(line.id);
        continue;
      }
      subtotal += computed.lineTotal;
      await this.requests.updateLine(line.id, {
        name: computed.name,
        unit_price: computed.unitPrice,
        quantity: computed.quantity,
        line_total: computed.lineTotal,
      });
    }
    await this.requests.update(requestId, { subtotal });
    return subtotal;
  }
}
