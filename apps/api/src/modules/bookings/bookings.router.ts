import { z } from "zod";
import { router, protectedProcedure } from "../../trpc/trpc";
import { openBookingRequestSchema } from "@sts/shared-types";
import { BookingsService } from "./bookings.service";

export const bookingsRouter = router({
  myBookingsPage: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).max(100000).default(1),
      filter: z.enum(["all", "upcoming", "past", "cancelled"]).default("upcoming"),
      type: z.enum(["hotel", "flight", "visa", "umrah", "hall"]).optional(),
      view: z.enum(["list", "trips"]).default("trips"),
      sort: z.enum(["created", "travel"]).default("created"),
    }))
    .query(async ({ ctx, input }) => (await ctx.resolve(BookingsService)).getMyBookingsPage(ctx.user!.id, input)),

  myPersonalBookingsPage: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).max(100000).default(1) }))
    .query(async ({ ctx, input }) => (await ctx.resolve(BookingsService)).getMyBookingsPage(ctx.user!.id, { page: input.page, filter: "all", personalOnly: true })),

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
