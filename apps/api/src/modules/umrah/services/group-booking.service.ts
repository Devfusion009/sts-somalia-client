import { BadRequestException, Injectable } from "@nestjs/common";
import { groupBookingErrorMessage, type CreateGroupBookingInput, type OrderResult } from "@sts/shared-types";
import { OrdersService } from "../../orders/orders.service";
import { UmrahBookingRepository } from "../repositories/umrah-booking.repository";

/**
 * A seat on a published departure. Booking and pilgrims are written in one
 * SQL transaction (create_umrah_group_booking), priced in SQL from the rate
 * card / departure / package, and refused once sales close; the insert
 * trigger re-checks seats under a row lock.
 */
@Injectable()
export class GroupBookingService {
  constructor(
    private readonly bookings: UmrahBookingRepository,
    private readonly orders: OrdersService
  ) {}

  async create(userId: string, input: CreateGroupBookingInput): Promise<OrderResult> {
    if (input.pilgrims.length !== input.numPilgrims) throw new BadRequestException("Add details for every pilgrim.");

    const agencyId = await this.orders.getActiveAgencyId(userId);
    const access = await this.orders.assertAgencyCanBookProduct(agencyId, "umrah");
    if (!access.ok) throw new BadRequestException(access.message);
    const agencyCustomerId = await this.orders.resolveBookedForCustomer(agencyId, input);
    // Public seats use the same short checkout reservation for customers and agents.

    const { id: bookingId, error } = await this.bookings.createGroupBooking({
      p_departure_id: input.departureId,
      p_num_pilgrims: input.numPilgrims,
      p_room_sharing: input.roomSharing ?? 0,
      p_special_requests: input.specialRequests ?? "",
      p_pilgrims: input.pilgrims.map((p) => ({
        full_name: p.full_name,
        gender: p.gender,
        date_of_birth: p.date_of_birth || null,
        nationality: p.nationality || null,
        passport_number: p.passport_number || null,
        passport_expiry: p.passport_expiry || null,
        mahram_name: p.mahram_name || null,
        mahram_relation: p.mahram_relation || null,
      })),
      p_agency_id: agencyId ?? undefined,
    });
    if (error || !bookingId) throw new BadRequestException(groupBookingErrorMessage(error?.message));

    try {
      const booking = await this.bookings.findPrice(bookingId);
      if (!booking) throw new BadRequestException("Could not create the booking.");
      const order = await this.orders.createForBooking({
        customerId: userId,
        bookedBy: userId,
        agencyId,
        agencyCustomerId,
        currency: booking.currency,
        itemType: "umrah",
        price: Number(booking.total_price),
        umrahBookingId: booking.id,
        hold: false,
      });
      return { orderId: order.id, requiresApproval: booking.booking_kind === "private" };
    } catch {
      // Undo the booking so its seats are not held by a booking with no order.
      await this.bookings.delete(bookingId);
      throw new BadRequestException("Could not create the order.");
    }
  }
}
