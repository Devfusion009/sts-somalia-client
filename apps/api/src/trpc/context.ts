import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { ContextIdFactory, ModuleRef } from "@nestjs/core";
import type { Type } from "@nestjs/common";
import type { User } from "@supabase/supabase-js";
import { getUserForToken } from "../infra/supabase/supabase-clients";

export interface Context {
  user: User | null;
  accessToken: string | null;
  /**
   * Resolves a request-scoped Nest provider — the same mechanism Nest's own
   * HTTP pipeline uses internally, invoked manually because tRPC is mounted
   * directly on Express (see main.ts) rather than through Nest's request
   * lifecycle. Lets any procedure pull RlsSupabaseService, AdminSupabaseService,
   * or a module's own service (e.g. AffiliatesService) and get the exact same
   * DI-resolved instance a REST controller in that module would get.
   */
  resolve: <T>(type: Type<T>) => Promise<T>;
}

/**
 * Phase-0 shipped tRPC's context as a parallel implementation of Nest's DI
 * (two supabase-client construction paths, provably equivalent but not
 * shared). Phase 1 (affiliates) is the first module with a real service
 * and a role-gated mutation, so this closes that gap for real: `resolve()`
 * uses ContextIdFactory + ModuleRef.resolve() to pull actual request-scoped
 * providers out of Nest's own container, per request.
 */
export function createContextFactory(moduleRef: ModuleRef) {
  return async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
    const contextId = ContextIdFactory.create();
    moduleRef.registerRequestByContextId(req, contextId);

    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    const user = token ? await getUserForToken(token) : null;

    return {
      user,
      accessToken: token,
      resolve: (type) => moduleRef.resolve(type, contextId, { strict: false }),
    };
  };
}
