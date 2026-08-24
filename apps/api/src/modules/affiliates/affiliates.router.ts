import { router, protectedProcedure, protectedAdminProcedure } from "../../trpc/trpc";
import { createAffiliateLinkSchema, recordAffiliatePayoutSchema } from "@sts/shared-types";
import { AffiliatesService } from "./affiliates.service";

export const affiliatesRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(AffiliatesService);
    return svc.getMyAffiliate(ctx.user!.id);
  }),

  myLinks: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(AffiliatesService);
    const affiliate = await svc.getMyAffiliate(ctx.user!.id);
    if (!affiliate) return [];
    return svc.getMyLinks(affiliate.id);
  }),

  myConversions: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(AffiliatesService);
    const affiliate = await svc.getMyAffiliate(ctx.user!.id);
    if (!affiliate) return [];
    return svc.getMyConversions(affiliate.id);
  }),

  myPayouts: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(AffiliatesService);
    const affiliate = await svc.getMyAffiliate(ctx.user!.id);
    if (!affiliate) return [];
    return svc.getMyPayouts(affiliate.id);
  }),

  /** affiliate/page.tsx needs affiliate+links+conversions+payouts together — one round trip instead of four. */
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(AffiliatesService);
    return svc.getDashboard(ctx.user!.id);
  }),

  createLink: protectedProcedure.input(createAffiliateLinkSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(AffiliatesService);
    return svc.createLink(ctx.user!.id, input);
  }),

  admin: router({
    recordPayout: protectedAdminProcedure
      .input(recordAffiliatePayoutSchema)
      .mutation(async ({ ctx, input }) => {
        const svc = await ctx.resolve(AffiliatesService);
        return svc.recordPayout(input);
      }),
  }),
});
