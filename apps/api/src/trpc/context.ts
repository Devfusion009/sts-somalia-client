import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "@supabase/supabase-js";
import { createRlsClient, getUserForToken } from "../infra/supabase/supabase-clients";

/**
 * tRPC's own per-request context — deliberately NOT routed through Nest's
 * request-scoped DI (RlsSupabaseService). Bridging Nest's request scope
 * into tRPC's context() requires ContextIdFactory/ModuleRef machinery
 * (or a third-party package like nestjs-trpc) that phase 0 didn't attempt;
 * this calls the same framework-agnostic helpers RlsSupabaseService wraps,
 * so REST and tRPC enforce identical RLS, just via two construction paths.
 * Worth revisiting once a second tRPC procedure needs real Nest-service
 * injection rather than a couple of shared functions.
 */
export interface Context {
  user: User | null;
  accessToken: string | null;
  rls: ReturnType<typeof createRlsClient> | null;
}

export async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) return { user: null, accessToken: null, rls: null };

  const user = await getUserForToken(token);
  if (!user) return { user: null, accessToken: null, rls: null };

  return { user, accessToken: token, rls: createRlsClient(token) };
}
