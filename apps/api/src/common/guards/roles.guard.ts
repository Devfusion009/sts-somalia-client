import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRE_PLATFORM_ADMIN } from "../decorators/roles.decorator";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import type { RequestWithUser } from "./supabase-auth.guard";

/**
 * Backend equivalent of apps/web's requirePlatformAdmin(): checks the
 * dedicated `profiles.is_platform_admin` column (deliberately not
 * `profiles.role`, which business-approval flows overwrite) — same
 * DB-driven source of truth as today, just reached from a guard instead
 * of a Server Component gate. Must run after SupabaseAuthGuard, which
 * populates request.user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rls: RlsSupabaseService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresPlatformAdmin = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_PLATFORM_ADMIN,
      [context.getHandler(), context.getClass()]
    );
    if (!requiresPlatformAdmin) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) throw new ForbiddenException("No authenticated user");

    const { data: profile, error } = await this.rls
      .get()
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", request.user.id)
      .single();

    if (error || !profile?.is_platform_admin) {
      throw new ForbiddenException("Platform admin access required");
    }
    return true;
  }
}
