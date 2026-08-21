import { Controller, Get, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../common/guards/supabase-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RlsSupabaseService } from "../infra/supabase/rls-supabase.service";
import { getMe } from "./health.logic";
import type { User } from "@supabase/supabase-js";

/**
 * REST path for the phase-0 proof endpoint. The tRPC router
 * (trpc/routers/health.router.ts) reaches the same health.logic.getMe()
 * through a separately-constructed RLS client (tRPC's own context, not
 * Nest's request scope — see trpc/context.ts for why) so both protocols
 * are provably equivalent, not just parallel implementations.
 */
@Controller("health")
export class HealthController {
  constructor(private readonly rls: RlsSupabaseService) {}

  @Get("me")
  @UseGuards(SupabaseAuthGuard)
  async me(@CurrentUser() user: User) {
    return getMe(this.rls.get(), user.id, user.email ?? null);
  }
}
