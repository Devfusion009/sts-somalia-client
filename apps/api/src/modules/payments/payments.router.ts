import { z } from "zod";
import { router, protectedProcedure, protectedAdminProcedure } from "../../trpc/trpc";
import {
  initiatePaymentSchema,
  cancelPendingPaymentSchema,
  adminConfirmPaymentSchema,
  recordPaymentSchema,
  saveWalletMethodSchema,
  deleteWalletMethodSchema,
  setDefaultWalletMethodSchema,
} from "@sts/shared-types";
import { PaymentsService } from "./payments.service";
import { AccountPaymentsService } from "./account.service";
import { CheckoutService } from "./checkout.service";
import { getAvailablePaymentMethods } from "./registry";

export const paymentsRouter = router({
  methods: protectedProcedure
    .input(z.object({ agencyWallet: z.object({ available: z.number(), currency: z.string() }).optional() }).optional())
    .query(({ input }) => getAvailablePaymentMethods(input)),

  orderForCheckout: protectedProcedure.input(z.object({ orderId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const svc = await ctx.resolve(CheckoutService);
    return svc.getOrderForCheckout(input.orderId);
  }),

  initiate: protectedProcedure.input(initiatePaymentSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(PaymentsService);
    return svc.initiatePayment(ctx.user!.id, input);
  }),

  confirmSifalo: protectedProcedure
    .input(z.object({ paymentId: z.string().uuid(), sid: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(PaymentsService);
      return svc.confirmSifaloReturn(input.paymentId, input.sid);
    }),

  confirmWaafi: protectedProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(PaymentsService);
      return svc.confirmWaafiReturn(input.paymentId);
    }),

  cancelPending: protectedProcedure.input(cancelPendingPaymentSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(PaymentsService);
    return svc.cancelPendingPayment(input.paymentId);
  }),

  account: router({
    savedMethods: protectedProcedure.query(async ({ ctx }) => {
      const svc = await ctx.resolve(AccountPaymentsService);
      return svc.getMySavedPaymentMethods(ctx.user!.id);
    }),

    receipts: protectedProcedure.query(async ({ ctx }) => {
      const svc = await ctx.resolve(AccountPaymentsService);
      return svc.getMyReceipts(ctx.user!.id);
    }),

    refunds: protectedProcedure.query(async ({ ctx }) => {
      const svc = await ctx.resolve(AccountPaymentsService);
      return svc.getMyRefunds(ctx.user!.id);
    }),

    saveWalletMethod: protectedProcedure.input(saveWalletMethodSchema).mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(AccountPaymentsService);
      return svc.saveWalletMethod(ctx.user!.id, input);
    }),

    deleteWalletMethod: protectedProcedure.input(deleteWalletMethodSchema).mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(AccountPaymentsService);
      await svc.deleteWalletMethod(ctx.user!.id, input.methodId);
      return { ok: true };
    }),

    setDefaultWalletMethod: protectedProcedure.input(setDefaultWalletMethodSchema).mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(AccountPaymentsService);
      await svc.setDefaultWalletMethod(ctx.user!.id, input.methodId);
      return { ok: true };
    }),
  }),

  admin: router({
    confirmPayment: protectedAdminProcedure.input(adminConfirmPaymentSchema).mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(PaymentsService);
      return svc.adminConfirmPayment(input.paymentId);
    }),

    recordPayment: protectedAdminProcedure.input(recordPaymentSchema).mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(PaymentsService);
      return svc.adminRecordPayment(input);
    }),
  }),
});
