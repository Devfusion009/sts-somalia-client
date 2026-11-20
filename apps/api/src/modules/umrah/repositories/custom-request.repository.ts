import { Injectable } from "@nestjs/common";
import type { Database } from "@sts/shared-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RlsSupabaseService } from "../../../infra/supabase/rls-supabase.service";

/** Read-only access to archived private-trip details used by historical bookings. */
@Injectable()
export class CustomRequestRepository {
  constructor(private readonly rls: RlsSupabaseService) {}

  private db(): SupabaseClient<Database> {
    return this.rls.get() as SupabaseClient<Database>;
  }

  async findHotelLines(requestId: string): Promise<{ category: string; name: string }[]> {
    const { data } = await this.db()
      .from("umrah_custom_request_services")
      .select("category, name")
      .eq("request_id", requestId)
      .in("category", ["hotel_makkah", "hotel_madinah"]);
    return data ?? [];
  }

  async findLinesForAdmin(requestId: string) {
    const { data } = await this.db()
      .from("umrah_custom_request_services")
      .select("id, category, name, price_unit, unit_price, quantity, line_total")
      .eq("request_id", requestId)
      .order("category");
    return data ?? [];
  }
}
