import { Controller, Get, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "../common/guards/supabase-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RlsSupabaseService } from "../infra/supabase/rls-supabase.service";
import { getMe } from "./health.logic";
import type { User } from "@supabase/supabase-js";

/**
 * REST path for the phase-0 proof endpoint. The tRPC router
 * (trpc/routers/health.router.ts) reaches the same health.logic.getMe()
 * through the identical DI-resolved RlsSupabaseService instance (see
 * trpc/context.ts's resolve()), not a separate client construction path —
 * both protocols now share Nest's real request-scoped DI.
 */
@Controller("health")
export class HealthController {
  constructor(private readonly rls: RlsSupabaseService) {}

  /** Unauthenticated liveness probe for the Docker healthcheck and deploy gate. */
  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("me")
  @UseGuards(SupabaseAuthGuard)
  async me(@CurrentUser() user: User) {
    return getMe(this.rls.get(), user.id, user.email ?? null);
  }
}
