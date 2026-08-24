import { BadRequestException, Injectable } from "@nestjs/common";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import { DEFAULT_PREFERENCES, type PreferenceValues, type SavePreferencesInput } from "@sts/shared-types";

/**
 * Direct port of apps/web's modules/preferences/{queries,actions}.ts.
 * Plain @Injectable(), request-scoped via RlsSupabaseService — same rule
 * as AffiliatesService (phase 1).
 */
@Injectable()
export class PreferencesService {
  constructor(private readonly rls: RlsSupabaseService) {}

  async getMyPreferences(userId: string): Promise<PreferenceValues & { profile_id: string }> {
    const { data } = await this.rls
      .get()
      .from("notification_preferences")
      .select("*")
      .eq("profile_id", userId)
      .maybeSingle();

    return data ?? { profile_id: userId, ...DEFAULT_PREFERENCES };
  }

  /**
   * FX rates keyed by target currency, for display-only conversion. Absent
   * rates are not an error: the caller falls back to the original currency
   * rather than inventing a number. Returns a plain object, not a Map —
   * apps/api's tRPC setup has no superjson-style transformer, so a Map
   * would serialize to `{}` over the wire.
   */
  async getFxRates(base = "USD"): Promise<Record<string, number>> {
    const { data } = await this.rls.get().from("fx_rates").select("quote_currency, rate").eq("base_currency", base);
    return Object.fromEntries((data ?? []).map((row) => [row.quote_currency, Number(row.rate)]));
  }

  async savePreferences(userId: string, input: SavePreferencesInput) {
    // Turning off every channel would leave us unable to tell someone their
    // visa was approved or their flight was rescheduled. Transactional
    // booking updates are not marketing, and there has to be one way to
    // reach a customer who is mid-trip.
    if (!input.emailEnabled && !input.smsEnabled && !input.whatsappEnabled) {
      throw new BadRequestException(
        "Keep at least one channel on so we can reach you about your bookings — visa decisions and schedule changes are sent this way."
      );
    }

    // profile_id is the primary key, so a plain upsert infers it correctly.
    const { error } = await this.rls.get().from("notification_preferences").upsert(
      {
        profile_id: userId,
        email_enabled: input.emailEnabled,
        sms_enabled: input.smsEnabled,
        whatsapp_enabled: input.whatsappEnabled,
        language: input.language,
        display_currency: input.displayCurrency,
      },
      { onConflict: "profile_id" }
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }
}
