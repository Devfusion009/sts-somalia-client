import { initTRPC, TRPCError } from "@trpc/server";
import { HttpException, Logger } from "@nestjs/common";
import type { Context } from "./context";
import { RlsSupabaseService } from "../infra/supabase/rls-supabase.service";

const t = initTRPC.context<Context>().create({
  // Stack traces stay in the server log; a client never sees file paths or code.
  errorFormatter({ shape }) {
    const data: Partial<typeof shape.data> = { ...shape.data };
    delete data.stack;
    return { ...shape, data };
  },
});

const HTTP_STATUS_TO_TRPC_CODE: Record<number, TRPCError["code"]> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_SUPPORTED",
  409: "CONFLICT",
  412: "PRECONDITION_FAILED",
  413: "PAYLOAD_TOO_LARGE",
  422: "UNPROCESSABLE_CONTENT",
  429: "TOO_MANY_REQUESTS",
};

/**
 * Every module's service throws plain NestJS HttpExceptions
 * (BadRequestException, ForbiddenException, ...) — the same exceptions a
 * REST controller in that module would throw, so business logic doesn't
 * need to know which transport it's running behind. Without this boundary,
 * tRPC treats any thrown error it doesn't itself recognize as an opaque
 * INTERNAL_SERVER_ERROR — confirmed in phase 1 (createLink) and phase 2
 * (preferences.save's validation), both surfacing real validation failures
 * as 500s. Applied once here, at the base every procedure builds on, so it
 * retroactively fixes every already-migrated procedure's error responses
 * too — no per-procedure patching.
 */
const requestLogger = new Logger("tRPC");

const baseProcedure = t.procedure.use(async ({ next, path, type, ctx }) => {
  const started = Date.now();
  const result = await next();
  // One line per call: what, who, how long, and how it ended. Bodies and
  // tokens are never logged.
  const ms = Date.now() - started;
  const who = ctx.user?.id ?? "anon";
  if (result.ok) {
    requestLogger.log(`${type} ${path} ok ${ms}ms user=${who}`);
  } else {
    const status = result.error.cause instanceof HttpException ? result.error.cause.getStatus() : 500;
    const line = `${type} ${path} ${status} ${ms}ms user=${who} — ${result.error.message}`;
    if (status >= 500) requestLogger.error(line, result.error.cause instanceof Error ? result.error.cause.stack : undefined);
    else requestLogger.warn(line);
  }
  // tRPC's own middleware chain never rejects — a downstream throw is
  // already caught internally and normalized to { ok: false, error }, with
  // error.code hardcoded to INTERNAL_SERVER_ERROR and the real thrown value
  // preserved only as error.cause (see @trpc/server's getTRPCErrorFromUnknown).
  // A try/catch around next() here is therefore dead code — nothing to
  // catch, next() always resolves. Inspecting the result shape instead.
  if (!result.ok && result.error.cause instanceof HttpException) {
    const cause = result.error.cause;
    const status = cause.getStatus();
    const code = HTTP_STATUS_TO_TRPC_CODE[status] ?? "INTERNAL_SERVER_ERROR";
    // Thrown (not returned) deliberately: this runs inside its own
    // callRecursive frame, which re-catches it and — because it's already a
    // real TRPCError instance — getTRPCErrorFromUnknown passes it through
    // unchanged instead of re-wrapping it back to INTERNAL_SERVER_ERROR.
    throw new TRPCError({ code, message: cause.message, cause });
  }
  return result;
});

export const router = t.router;
export const publicProcedure = baseProcedure;

/** Throws UNAUTHORIZED if createContext() couldn't resolve a user from the bearer token. */
export const protectedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing or invalid bearer token" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * tRPC equivalent of RolesGuard + @RequirePlatformAdmin() — same
 * `profiles.is_platform_admin` source of truth, reached via a real
 * DI-resolved RlsSupabaseService (ctx.resolve), not a second client
 * construction path.
 */
export const protectedAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const rls = await ctx.resolve(RlsSupabaseService);
  const { data: profile, error } = await rls
    .get()
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", ctx.user!.id)
    .single();

  if (error || !profile?.is_platform_admin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
  }
  return next({ ctx });
});
