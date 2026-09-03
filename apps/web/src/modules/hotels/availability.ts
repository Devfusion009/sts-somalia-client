import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RoomNight = {
  night: string;
  capacity: number | null;
  booked: number;
  b2b: number;
  b2c: number;
  confirmed: number;
  pending: number;
  available: number | null;
  priceOverride: number | null;
};

export type RoomAvailability = {
  roomId: string;
  roomName: string;
  roomStatus: string;
  totalUnits: number | null;
  nights: RoomNight[];
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function todayIso() {
  return isoDate(new Date());
}

/**
 * The availability board for one hotel (every room × night) or one room —
 * one RPC, gated in the database to admins, the owning partner's members
 * and the hotel's managers. Capacity is the per-date override else the
 * room's baseline; null means the room count has not been set yet.
 */
export async function getHotelAvailability(
  hotelId: string,
  options: { from?: string; days?: number; roomId?: string } = {}
): Promise<RoomAvailability[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("hotel_availability", {
    p_hotel_id: hotelId,
    p_from: options.from ?? todayIso(),
    p_days: options.days ?? 14,
    p_room_id: options.roomId,
  });

  const rooms = new Map<string, RoomAvailability>();
  for (const row of data ?? []) {
    let room = rooms.get(row.room_id);
    if (!room) {
      room = {
        roomId: row.room_id,
        roomName: row.room_name,
        roomStatus: row.room_status,
        totalUnits: row.room_total_units,
        nights: [],
      };
      rooms.set(row.room_id, room);
    }
    room.nights.push({
      night: row.night,
      capacity: row.capacity,
      booked: row.booked,
      b2b: row.b2b,
      b2c: row.b2c,
      confirmed: row.confirmed,
      pending: row.pending,
      available: row.available,
      priceOverride: row.price_override === null ? null : Number(row.price_override),
    });
  }
  return [...rooms.values()];
}
