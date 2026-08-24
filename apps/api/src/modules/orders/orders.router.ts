import { z } from "zod";
import { router, protectedProcedure } from "../../trpc/trpc";
import {
  cancelOrderSchema,
  createOrderForBookingSchema,
  getAgencyMarkupAmountSchema,
  resolveBookedForCustomerSchema,
} from "@sts/shared-types";
import { OrdersService } from "./orders.service";

export const ordersRouter = router({
  convertHoldToCheckout: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(OrdersService);
      return svc.convertHoldToCheckout(input.orderId);
    }),

  cancel: protectedProcedure.input(cancelOrderSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(OrdersService);
    return svc.cancel(input.orderId, input.reason);
  }),

  /**
   * Phase-4a: exposed over tRPC for direct testability (nothing else calls
   * this yet — flights/events/payments migrate their booking-creation
   * action files in a follow-up phase). Once those exist as backend
   * modules, prefer injecting OrdersService directly over calling this
   * procedure internally.
   */
  createForBooking: protectedProcedure.input(createOrderForBookingSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(OrdersService);
    return svc.createForBooking(input);
  }),

  getAgencyMarkupAmount: protectedProcedure.input(getAgencyMarkupAmountSchema).query(async ({ ctx, input }) => {
    const svc = await ctx.resolve(OrdersService);
    return svc.getAgencyMarkupAmount(input.agencyId, input.itemType, input.netPrice);
  }),

  resolveBookedForCustomer: protectedProcedure.input(resolveBookedForCustomerSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(OrdersService);
    const { agencyId, ...rest } = input;
    return svc.resolveBookedForCustomer(agencyId, rest);
  }),
});
