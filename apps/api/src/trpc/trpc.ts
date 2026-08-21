import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Throws UNAUTHORIZED if createContext() couldn't resolve a user from the bearer token. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.rls) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing or invalid bearer token" });
  }
  return next({ ctx: { ...ctx, user: ctx.user, rls: ctx.rls } });
});
