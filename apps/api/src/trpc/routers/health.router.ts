import { router, protectedProcedure } from "../trpc";
import { getMe } from "../../health/health.logic";

export const healthRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return getMe(ctx.rls, ctx.user.id, ctx.user.email ?? null);
  }),
});
