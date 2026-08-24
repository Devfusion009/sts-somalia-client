import { router, protectedProcedure } from "../trpc";
import { RlsSupabaseService } from "../../infra/supabase/rls-supabase.service";
import { getMe } from "../../health/health.logic";

export const healthRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const rls = await ctx.resolve(RlsSupabaseService);
    return getMe(rls.get(), ctx.user!.id, ctx.user!.email ?? null);
  }),
});
