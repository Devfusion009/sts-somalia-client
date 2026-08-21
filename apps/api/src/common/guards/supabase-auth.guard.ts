import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { User } from "@supabase/supabase-js";
import { getUserForToken } from "../../infra/supabase/supabase-clients";

export interface RequestWithUser extends Request {
  user?: User;
}

/**
 * Backend equivalent of apps/web's requireUser() — except there's no
 * cookie or redirect() here, only a bearer token and a thrown exception.
 * apps/web still owns the actual sign-in; this guard only ever sees the
 * short-lived access token it forwards, never a password.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) throw new UnauthorizedException("Missing bearer token");

    const user = await getUserForToken(token);
    if (!user) throw new UnauthorizedException("Invalid or expired token");

    request.user = user;
    return true;
  }
}
