import { Injectable } from "@nestjs/common";
import { parseUmrahOperations, UMRAH_OPERATIONS_DEFAULTS, type UmrahOperations } from "@sts/shared-types";
import { createAdminClient } from "../../../infra/supabase/supabase-clients";

/** platform_settings 'umrah_operations' — read with the service role, same as SQL's umrah_setting(). */
@Injectable()
export class UmrahSettingsRepository {
  async getOperations(): Promise<UmrahOperations> {
    try {
      const { data } = await createAdminClient()
        .from("platform_settings")
        .select("value")
        .eq("key", "umrah_operations")
        .maybeSingle();
      return parseUmrahOperations((data?.value ?? null) as Record<string, unknown> | null);
    } catch {
      return UMRAH_OPERATIONS_DEFAULTS;
    }
  }
}
