import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UMRAH_FULFILLMENT_STAGES, roomErrorMessage, stageErrorMessage } from "@sts/shared-types";
import { UmrahBookingRepository } from "../repositories/umrah-booking.repository";
import { UmrahNotifyService } from "./umrah-notify.service";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/** Admin: departure operations — seats, cancellation, bulk stage moves, rooms. */
@Injectable()
export class DepartureAdminService {
  constructor(
    private readonly bookings: UmrahBookingRepository,
    private readonly notify: UmrahNotifyService
  ) {}

  overview(from: string) {
    return this.bookings.departuresOverview(from);
  }

  async detail(departureId: string) {
    const { departure, manifest, rooms } = await this.bookings.departureDetail(departureId);
    if (!departure) throw new NotFoundException("Departure not found.");
    return {
      departure: { ...departure, package: one(departure.package) },
      manifest,
      rooms: rooms.map((r) => ({ ...r, occupants: (r.umrah_room_occupants ?? []).map((o: { pilgrim_id: string }) => o.pilgrim_id) })),
    };
  }

  async releaseUnpaid() {
    const released = await this.bookings.expireUnpaid();
    return { message: released === 1 ? "1 booking released." : `${released} bookings released.` };
  }

  async cancel(departureId: string, reason: string) {
    const live = await this.bookings.findLiveBookingIds(departureId);
    await this.bookings.cancelDeparture(departureId, reason);
    for (const id of live) this.notify.send(id, "booking_cancelled", reason);
  }

  /**
   * Moves every live booking behind `stage` forward to it, one at a time
   * through the stage RPC, so each is checked (payment, readiness) as a single move would be.
   */
  async advance(departureId: string, stage: (typeof UMRAH_FULFILLMENT_STAGES)[number]) {
    const behind = UMRAH_FULFILLMENT_STAGES.slice(0, UMRAH_FULFILLMENT_STAGES.indexOf(stage));
    const rows = await this.bookings.findBehindStage(departureId, behind);
    let moved = 0;
    const skipped: { reference: string; reason: string }[] = [];
    for (const booking of rows) {
      const linked = one(booking.order_items?.[0]?.order as { order_number: string } | null);
      const reference = linked?.order_number ?? String(booking.id).slice(0, 8);
      const error = await this.bookings.setStage(booking.id, stage);
      if (error) skipped.push({ reference, reason: stageErrorMessage(error.message) });
      else {
        moved += 1;
        this.notify.send(booking.id, "stage_changed", undefined, stage);
      }
    }
    return { message: `${moved} moved, ${skipped.length} skipped.`, skipped };
  }

  async createRoom(d: { departureId: string; city: string; label: string; capacity: number; gender: string | null }) {
    const error = await this.bookings.insertRoom({
      departure_id: d.departureId,
      city: d.city,
      room_label: d.label,
      capacity: d.capacity,
      gender: d.gender,
    });
    if (error) throw new BadRequestException(error.code === "23505" ? "That room already exists in this city." : "The room could not be added.");
  }

  async deleteRoom(roomId: string) {
    return { departureId: await this.bookings.deleteRoom(roomId) };
  }

  /** A pilgrim, or every pilgrim of one booking (`booking:<id>`) together — all fit or none are added. */
  async assign(roomId: string, target: string) {
    const room = await this.bookings.findRoom(roomId);
    if (!room) throw new NotFoundException("Room not found.");
    const uuid = /^[0-9a-f-]{36}$/i;
    let pilgrimIds: string[] = [];
    if (target.startsWith("booking:")) {
      const bookingId = target.slice("booking:".length);
      if (!uuid.test(bookingId)) throw new BadRequestException("Choose a pilgrim or booking.");
      pilgrimIds = await this.bookings.findPilgrimIds(bookingId);
    } else if (uuid.test(target)) {
      pilgrimIds = [target];
    }
    if (pilgrimIds.length === 0) throw new BadRequestException("Choose a pilgrim or booking.");
    const error = await this.bookings.insertOccupants(room.id, pilgrimIds);
    if (error) throw new BadRequestException(error.code === "23505" ? "Already in this room." : roomErrorMessage(error.message));
    return { departureId: room.departure_id };
  }

  removeOccupant(roomId: string, pilgrimId: string) {
    return this.bookings.deleteOccupant(roomId, pilgrimId);
  }
}
