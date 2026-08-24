import { router, publicProcedure, protectedProcedure } from "../../trpc/trpc";
import { flightSearchParamsSchema, flightOffersFilterSchema, requestFlightQuoteSchema } from "@sts/shared-types";
import { FlightsService } from "./flights.service";

/**
 * Airports/offer-cache reads and live search are public (unauthenticated) in
 * the original — flight search doesn't require a login, matching the
 * marketing flights page. Only the quote request needs a caller.
 */
export const flightsRouter = router({
  airports: publicProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(FlightsService);
    return svc.getAirports();
  }),

  offers: publicProcedure.input(flightOffersFilterSchema).query(async ({ ctx, input }) => {
    const svc = await ctx.resolve(FlightsService);
    return svc.searchFlightOffers(input);
  }),

  searchLive: publicProcedure.input(flightSearchParamsSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(FlightsService);
    return svc.searchLive(input);
  }),

  requestQuote: protectedProcedure.input(requestFlightQuoteSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(FlightsService);
    return svc.requestQuote(ctx.user!.id, input);
  }),
});
