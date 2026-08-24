import { z } from "zod";
import { router, protectedProcedure } from "../../trpc/trpc";
import { openBookingRequestSchema } from "@sts/shared-types";
import { BookingsService } from "./bookings.service";

export const bookingsRouter = router({
  myBookings: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(BookingsService);
    return svc.getMyBookings(ctx.user!.id);
  }),

  requestsForOrder: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const svc = await ctx.resolve(BookingsService);
      return svc.getBookingRequests(input.orderId);
    }),

  myRequests: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(BookingsService);
    return svc.getMyBookingRequests(ctx.user!.id);
  }),

  openRequest: protectedProcedure.input(openBookingRequestSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(BookingsService);
    return svc.openBookingRequest(ctx.user!.id, input);
  }),

  withdrawRequest: protectedProcedure
    .input(z.object({ requestId: z.string().uuid(), orderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(BookingsService);
      return svc.withdrawBookingRequest(ctx.user!.id, input.requestId);
    }),
});
