import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../../trpc/trpc";
import {
  venueFiltersSchema,
  venueOccupiedRangesSchema,
  createHallBookingSchema,
  venueUpsertSchema,
  updateMyVenueSchema,
  updateVenueBookingStatusSchema,
} from "@sts/shared-types";
import { EventsService } from "./events.service";
import { VenuePartnerService } from "./venue-partner.service";

export const eventsRouter = router({
  venues: publicProcedure.input(venueFiltersSchema.optional()).query(async ({ ctx, input }) => {
    const svc = await ctx.resolve(EventsService);
    return svc.getVenues(input ?? {});
  }),

  venueBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const svc = await ctx.resolve(EventsService);
    return svc.getVenueBySlug(input.slug);
  }),

  venueEventTypes: publicProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(EventsService);
    return svc.getVenueEventTypes();
  }),

  venueOccupiedRanges: protectedProcedure.input(venueOccupiedRangesSchema).query(async ({ ctx, input }) => {
    const svc = await ctx.resolve(EventsService);
    return svc.getVenueOccupiedRanges(input);
  }),

  createHallBooking: protectedProcedure.input(createHallBookingSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(EventsService);
    return svc.createHallBooking(ctx.user!.id, input);
  }),

  /** Venue Portal — different audience (venue owners), same module, separate service. */
  partner: router({
    myPartnerId: protectedProcedure.query(async ({ ctx }) => {
      const svc = await ctx.resolve(VenuePartnerService);
      return svc.getMyVenuePartnerId(ctx.user!.id);
    }),

    myPartner: protectedProcedure.input(z.object({ partnerId: z.string().uuid() })).query(async ({ ctx, input }) => {
      const svc = await ctx.resolve(VenuePartnerService);
      return svc.getMyVenuePartner(input.partnerId);
    }),

    myVenues: protectedProcedure.input(z.object({ partnerId: z.string().uuid() })).query(async ({ ctx, input }) => {
      const svc = await ctx.resolve(VenuePartnerService);
      return svc.getMyVenues(input.partnerId);
    }),

    venueForEdit: protectedProcedure
      .input(z.object({ partnerId: z.string().uuid(), venueId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const svc = await ctx.resolve(VenuePartnerService);
        return svc.getVenueForEdit(input.partnerId, input.venueId);
      }),

    venueBookings: protectedProcedure.input(z.object({ partnerId: z.string().uuid() })).query(async ({ ctx, input }) => {
      const svc = await ctx.resolve(VenuePartnerService);
      return svc.getVenueBookings(input.partnerId);
    }),

    stats: protectedProcedure.input(z.object({ partnerId: z.string().uuid() })).query(async ({ ctx, input }) => {
      const svc = await ctx.resolve(VenuePartnerService);
      return svc.getVenuePartnerStats(input.partnerId);
    }),

    createVenue: protectedProcedure.input(venueUpsertSchema).mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(VenuePartnerService);
      return svc.createMyVenue(ctx.user!.id, input);
    }),

    updateVenue: protectedProcedure.input(updateMyVenueSchema).mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(VenuePartnerService);
      return svc.updateMyVenue(ctx.user!.id, input);
    }),

    updateBookingStatus: protectedProcedure.input(updateVenueBookingStatusSchema).mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(VenuePartnerService);
      return svc.updateVenueBookingStatus(ctx.user!.id, input.bookingId, input.status);
    }),
  }),
});
