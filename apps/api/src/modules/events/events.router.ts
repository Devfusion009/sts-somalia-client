import { z } from "zod";
import {
  createHallBookingResultSchema,
  createHallBookingSchema,
  partnerVenueRefSchema,
  publicVenueDetailSchema,
  publicVenueSchema,
  updateMyVenueSchema,
  updateVenueBookingStatusSchema,
  venueFiltersSchema,
  venueOccupiedRangesSchema,
  venueUpsertSchema,
} from "@sts/shared-types";
import { router, publicProcedure, protectedProcedure } from "../../trpc/trpc";
import { EventsService } from "./events.service";
import { VenuePartnerService } from "./venue-partner.service";

/**
 * Transport only: each procedure declares its input and output DTO, resolves
 * the service and passes the caller's id. No rules and no queries here.
 */
export const eventsRouter = router({
  venues: publicProcedure
    .input(venueFiltersSchema.optional())
    .output(z.array(publicVenueSchema))
    .query(async ({ ctx, input }) => (await ctx.resolve(EventsService)).getVenues(input ?? {})),

  venueBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .output(publicVenueDetailSchema.nullable())
    .query(async ({ ctx, input }) => (await ctx.resolve(EventsService)).getVenueBySlug(input.slug)),

  venueEventTypes: publicProcedure
    .output(z.array(z.string()))
    .query(async ({ ctx }) => (await ctx.resolve(EventsService)).getVenueEventTypes()),

  venueOccupiedRanges: protectedProcedure
    .input(venueOccupiedRangesSchema)
    .query(async ({ ctx, input }) => (await ctx.resolve(EventsService)).getVenueOccupiedRanges(input)),

  createHallBooking: protectedProcedure
    .input(createHallBookingSchema)
    .output(createHallBookingResultSchema)
    .mutation(async ({ ctx, input }) => (await ctx.resolve(EventsService)).createHallBooking(ctx.user.id, input)),

  /** Venue Portal — the partner comes from the session, never from the input. */
  partner: router({
    me: protectedProcedure.query(async ({ ctx }) => (await ctx.resolve(VenuePartnerService)).getMyPartner(ctx.user.id)),

    venues: protectedProcedure.query(async ({ ctx }) =>
      (await ctx.resolve(VenuePartnerService)).getMyVenues(ctx.user.id)
    ),

    venue: protectedProcedure
      .input(partnerVenueRefSchema)
      .query(async ({ ctx, input }) => (await ctx.resolve(VenuePartnerService)).getVenueForEdit(ctx.user.id, input.venueId)),

    bookings: protectedProcedure.query(async ({ ctx }) =>
      (await ctx.resolve(VenuePartnerService)).getVenueBookings(ctx.user.id)
    ),

    stats: protectedProcedure.query(async ({ ctx }) => (await ctx.resolve(VenuePartnerService)).getStats(ctx.user.id)),

    createVenue: protectedProcedure
      .input(venueUpsertSchema)
      .mutation(async ({ ctx, input }) => (await ctx.resolve(VenuePartnerService)).createVenue(ctx.user.id, input)),

    updateVenue: protectedProcedure
      .input(updateMyVenueSchema)
      .mutation(async ({ ctx, input }) => (await ctx.resolve(VenuePartnerService)).updateVenue(ctx.user.id, input)),

    updateBookingStatus: protectedProcedure
      .input(updateVenueBookingStatusSchema)
      .mutation(async ({ ctx, input }) =>
        (await ctx.resolve(VenuePartnerService)).updateBookingStatus(ctx.user.id, input)
      ),
  }),
});
