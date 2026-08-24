import { z } from "zod";
import { router, protectedProcedure } from "../../trpc/trpc";
import { travelerSchema, saveTravelerSchema, deleteTravelerSchema, deleteVaultDocumentSchema } from "@sts/shared-types";
import { TravelersService } from "./travelers.service";

/**
 * File upload/delete for the document vault is a plain REST multipart
 * endpoint (travelers.controller.ts), not a tRPC procedure — binary doesn't
 * carry well over tRPC. Everything else lives here.
 */
export const travelersRouter = router({
  myTravelers: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(TravelersService);
    return svc.getMyTravelers(ctx.user!.id);
  }),

  selfTraveler: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(TravelersService);
    return svc.getSelfTraveler(ctx.user!.id);
  }),

  myDocuments: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(TravelersService);
    return svc.getMyDocuments(ctx.user!.id);
  }),

  documentDownloadUrl: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const svc = await ctx.resolve(TravelersService);
      return svc.getDocumentDownloadUrl(ctx.user!.id, input.documentId);
    }),

  saveSelf: protectedProcedure.input(travelerSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(TravelersService);
    return svc.saveSelfTraveler(ctx.user!.id, input);
  }),

  save: protectedProcedure.input(saveTravelerSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(TravelersService);
    return svc.saveTraveler(ctx.user!.id, input);
  }),

  delete: protectedProcedure.input(deleteTravelerSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(TravelersService);
    return svc.deleteTraveler(ctx.user!.id, input.travelerId);
  }),

  deleteDocument: protectedProcedure.input(deleteVaultDocumentSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(TravelersService);
    return svc.deleteVaultDocument(ctx.user!.id, input.documentId);
  }),
});
