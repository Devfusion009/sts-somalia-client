import { z } from "zod";
import { router, protectedProcedure } from "../../trpc/trpc";
import { savePreferencesSchema } from "@sts/shared-types";
import { PreferencesService } from "./preferences.service";

export const preferencesRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(PreferencesService);
    return svc.getMyPreferences(ctx.user!.id);
  }),

  fxRates: protectedProcedure.input(z.object({ base: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const svc = await ctx.resolve(PreferencesService);
    return svc.getFxRates(input?.base ?? "USD");
  }),

  save: protectedProcedure.input(savePreferencesSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(PreferencesService);
    return svc.savePreferences(ctx.user!.id, input);
  }),
});
