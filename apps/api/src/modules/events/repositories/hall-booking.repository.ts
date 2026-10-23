import { Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@sts/shared-types";
import { RlsSupabaseService } from "../../../infra/supabase/rls-supabase.service";
import { dbException, throwIfDbError } from "../../../common/errors/db-error";

export type HallBookingInsert = Database["public"]["Tables"]["hall_bookings"]["Insert"];
type HallBookingStatus = Database["public"]["Enums"]["booking_status"];

/** Data access for hall_bookings. The database guards (allocator, status, capacity) stay the authority. */
@Injectable()
export class HallBookingRepository {
  constructor(private readonly rls: RlsSupabaseService) {}

  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  async insert(row: HallBookingInsert) {
    const { data, error } = await this.db().from("hall_bookings").insert(row).select("id, status").single();
    if (error || !data) throw dbException(error ?? { message: "no row" }, "Could not create the booking.");
    return data;
  }

  async findForVenues(venueIds: string[]) {
    const { data, error } = await this.db()
      .from("hall_bookings")
      .select(
        "id, venue_id, booking_ref, event_type, event_name, start_date, end_date, start_time, end_time, expected_guests, setup_requirements, price, currency, status, created_at, contact_name, contact_phone, contact_email, venue:event_venues(name)"
      )
      .in("venue_id", venueIds)
      .order("created_at", { ascending: false });
    throwIfDbError(error, "Bookings could not be loaded.");
    return data ?? [];
  }

  /** Status change under the caller's RLS; null when the row isn't theirs or moved meanwhile. */
  async updateStatus(bookingId: string, venueIds: string[], from: HallBookingStatus, to: HallBookingStatus) {
    const { data, error } = await this.db()
      .from("hall_bookings")
      .update({ status: to })
      .eq("id", bookingId)
      .in("venue_id", venueIds)
      .eq("status", from)
      .select("id")
      .maybeSingle();
    throwIfDbError(error, "The booking could not be updated.");
    return data;
  }

  async findStatus(bookingId: string, venueIds: string[]) {
    const { data, error } = await this.db()
      .from("hall_bookings")
      .select("id, status, start_date, end_date, price")
      .eq("id", bookingId)
      .in("venue_id", venueIds)
      .maybeSingle();
    throwIfDbError(error, "The booking could not be loaded.");
    return data;
  }
}
