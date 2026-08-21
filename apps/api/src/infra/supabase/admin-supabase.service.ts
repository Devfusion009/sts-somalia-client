import { Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase-clients";

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * Only inject this into modules that genuinely need it — webhook/payment
 * reconciliation, trusted server-side integrations, admin-only background
 * jobs. This is now enforced by which modules list it as a dependency
 * (visible in the module graph) rather than by a doc comment, per the
 * 7-file "mixed client" smell the source audit found in apps/web.
 */
@Injectable()
export class AdminSupabaseService {
  private client: SupabaseClient | null = null;

  get(): SupabaseClient {
    if (!this.client) this.client = createAdminClient();
    return this.client;
  }
}
