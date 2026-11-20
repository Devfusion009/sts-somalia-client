import { z } from "zod";
import { router, publicProcedure, protectedProcedure, protectedAdminProcedure } from "../../trpc/trpc";
import { bookFlightSchema, flightSearchParamsSchema } from "@sts/shared-types";
import { FlightsService } from "./flights.service";
import { flightProviderReadiness } from "./flight-provider";

/**
 * Airports and search are public (the marketing flights page needs no
 * login); booking needs a signed-in caller.
 */
export const flightsRouter = router({
  providerReadiness: protectedAdminProcedure.input(z.object({ providerKey: z.string() })).query(({ input }) => flightProviderReadiness(input.providerKey)),
  airports: publicProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(FlightsService);
    return svc.getAirports();
  }),

  search: publicProcedure.input(flightSearchParamsSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(FlightsService);
    return svc.search(input);
  }),

  offer: publicProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const svc = await ctx.resolve(FlightsService);
    return svc.getOffer(input.id);
  }),

  book: protectedProcedure.input(bookFlightSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(FlightsService);
    return svc.book(ctx.user!.id, input);
  }),
});
