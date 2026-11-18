import { PoolRequestService } from "./services/pool-request.service";
import { submitPoolRequestSchema, configurePoolSchema } from "@sts/shared-types";
import { z } from "zod";
import {
  adminCancelBookingSchema,
  advanceDepartureSchema,
  advanceStageSchema,
  bookingRefSchema,
  cancelDepartureSchema,
  createGroupBookingSchema,
  customRequestSchema,
  draftRequestSchema,
  submittedRequestSchema,
  departureRefSchema,
  departuresOverviewSchema,
  departureUpsertSchema,
  documentRefSchema,
  imagePathSchema,
  imageSignSchema,
  itineraryDaySchema,
  orderResultSchema,
  packageAgenciesSchema,
  packageCardSchema,
  packageChildRefSchema,
  packageDetailSchema,
  packageDetailsSchema,
  packageHotelSchema,
  packagePricingSchema,
  packageRefSchema,
  packageUpsertSchema,
  reviewDocumentSchema,
  requestDecisionSchema,
  requestPriceSchema,
  requestRefSchema,
  roomAssignSchema,
  roomCreateSchema,
  roomOccupantSchema,
  roomRefSchema,
  segmentRefSchema,
  segmentUpsertSchema,
  serviceRefSchema,
  serviceUpsertSchema,
  sharingPriceMapSchema,
  startTripResultSchema,
  submitTripSchema,
  tripBasicsSchema,
  tripPilgrimsSchema,
  tripServicesSchema,
  umrahBookingsFilterSchema,
  umrahServiceSchema,
  updatePilgrimSchema,
} from "@sts/shared-types";
import { router, publicProcedure, protectedProcedure, protectedAdminProcedure } from "../../trpc/trpc";
import { UmrahCatalogService } from "./services/umrah-catalog.service";
import { GroupBookingService } from "./services/group-booking.service";
import { PrivateTripService } from "./services/private-trip.service";
import { PilgrimService } from "./services/pilgrim.service";
import { PackageAdminService } from "./services/package-admin.service";
import { ServiceAdminService } from "./services/service-admin.service";
import { DepartureAdminService } from "./services/departure-admin.service";
import { FulfillmentAdminService } from "./services/fulfillment-admin.service";

const stepResult = z.object({ step: z.number() });

/** Transport only: input DTO -> service -> output DTO. Identity always comes from ctx.user. */
export const umrahRouter = router({
  // ---- public catalog ----
  featured: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).default(4) }))
    .output(z.array(packageCardSchema))
    .query(async ({ ctx, input }) => (await ctx.resolve(UmrahCatalogService)).featuredPackages(input.limit)),

  assignedPackages: protectedProcedure.output(z.array(packageCardSchema)).query(async ({ ctx }) => (await ctx.resolve(UmrahCatalogService)).assignedPackages()),

  packages: publicProcedure
    .output(z.array(packageCardSchema))
    .query(async ({ ctx }) => (await ctx.resolve(UmrahCatalogService)).allPackages()),

  packageBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .output(packageDetailSchema.nullable())
    .query(async ({ ctx, input }) => (await ctx.resolve(UmrahCatalogService)).packageBySlug(input.slug)),

  services: publicProcedure
    .output(z.array(umrahServiceSchema))
    .query(async ({ ctx }) => (await ctx.resolve(UmrahCatalogService)).publishedServices()),

  sharingPrices: publicProcedure
    .output(sharingPriceMapSchema)
    .query(async ({ ctx }) => (await ctx.resolve(UmrahCatalogService)).sharingPrices()),

  operations: publicProcedure.query(async ({ ctx }) => (await ctx.resolve(UmrahCatalogService)).operations()),

  poolRequests: router({
    enabled: protectedAdminProcedure.query(async ({ctx}) => (await ctx.resolve(PoolRequestService)).enabled()),
    openReplacements: protectedAdminProcedure.input(departureRefSchema).mutation(async ({ctx,input}) => (await ctx.resolve(PoolRequestService)).openReplacements(input.departureId)),
    delivery: protectedAdminProcedure.input(departureRefSchema).query(async ({ctx,input}) => (await ctx.resolve(PoolRequestService)).delivery(input.departureId)),
    resend: protectedAdminProcedure.input(z.object({jobId:z.string().uuid()})).mutation(async ({ctx,input}) => (await ctx.resolve(PoolRequestService)).resend(input.jobId)),
    submit: protectedProcedure.input(submitPoolRequestSchema).mutation(async ({ctx,input}) => (await ctx.resolve(PoolRequestService)).submit(input)),
    list: protectedProcedure.query(async ({ctx}) => (await ctx.resolve(PoolRequestService)).list()),
    get: protectedProcedure.input(requestRefSchema).query(async ({ctx,input}) => (await ctx.resolve(PoolRequestService)).get(input.requestId)),
    withdraw: protectedProcedure.input(requestRefSchema).mutation(async ({ctx,input}) => (await ctx.resolve(PoolRequestService)).withdraw(input.requestId)),
    configure: protectedAdminProcedure.input(configurePoolSchema).mutation(async ({ctx,input}) => (await ctx.resolve(PoolRequestService)).configure(input)),
    departures: protectedAdminProcedure.input(packageRefSchema).query(async ({ctx,input}) => (await ctx.resolve(PoolRequestService)).departures(input.packageId)),
    applicants: protectedAdminProcedure.input(departureRefSchema).query(async ({ctx,input}) => (await ctx.resolve(PoolRequestService)).list(input.departureId)),
  }),
  // ---- customer / agent ----
  bookingTravel: protectedProcedure
    .input(bookingRefSchema)
    .query(async ({ ctx, input }) => (await ctx.resolve(UmrahCatalogService)).bookingTravel(input.bookingId)),

  bookingFile: protectedProcedure
    .input(bookingRefSchema)
    .query(async ({ ctx, input }) => (await ctx.resolve(UmrahCatalogService)).bookingFile(input.bookingId)),

  createGroupBooking: protectedProcedure
    .input(createGroupBookingSchema)
    .output(orderResultSchema)
    .mutation(async ({ ctx, input }) => (await ctx.resolve(GroupBookingService)).create(ctx.user.id, input)),

  trip: router({
    start: protectedProcedure
      .output(startTripResultSchema)
      .mutation(async ({ ctx }) => (await ctx.resolve(PrivateTripService)).start(ctx.user.id)),
    myDraft: protectedProcedure
      .output(draftRequestSchema.nullable())
      .query(async ({ ctx }) => (await ctx.resolve(PrivateTripService)).myDraft(ctx.user.id)),
    get: protectedProcedure
      .input(requestRefSchema)
      .output(customRequestSchema.nullable())
      .query(async ({ ctx, input }) => (await ctx.resolve(PrivateTripService)).get(input.requestId)),
    saveBasics: protectedProcedure
      .input(tripBasicsSchema)
      .output(stepResult)
      .mutation(async ({ ctx, input }) => (await ctx.resolve(PrivateTripService)).saveBasics(ctx.user.id, input)),
    saveServices: protectedProcedure
      .input(tripServicesSchema)
      .output(stepResult)
      .mutation(async ({ ctx, input }) => (await ctx.resolve(PrivateTripService)).saveServices(ctx.user.id, input)),
    savePilgrims: protectedProcedure
      .input(tripPilgrimsSchema)
      .output(stepResult)
      .mutation(async ({ ctx, input }) => (await ctx.resolve(PrivateTripService)).savePilgrims(ctx.user.id, input)),
    submit: protectedProcedure
      .input(submitTripSchema)
      .output(orderResultSchema)
      .mutation(async ({ ctx, input }) => (await ctx.resolve(PrivateTripService)).submit(ctx.user.id, input)),
    discard: protectedProcedure
      .input(requestRefSchema)
      .mutation(async ({ ctx, input }) => (await ctx.resolve(PrivateTripService)).discard(ctx.user.id, input.requestId)),
  }),

  pilgrims: router({
    update: protectedProcedure
      .input(updatePilgrimSchema)
      .mutation(async ({ ctx, input }) => (await ctx.resolve(PilgrimService)).update(input)),
    deleteDocument: protectedProcedure
      .input(documentRefSchema)
      .mutation(async ({ ctx, input }) => (await ctx.resolve(PilgrimService)).deleteHandIn(input.documentId)),
  }),

  // ---- admin ----
  admin: router({
    packages: router({
      list: protectedAdminProcedure.query(async ({ ctx }) => (await ctx.resolve(PackageAdminService)).list()),
      get: protectedAdminProcedure
        .input(packageRefSchema)
        .query(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).get(input.packageId)),
      upsert: protectedAdminProcedure
        .input(packageUpsertSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).upsert(input)),
      updateDetails: protectedAdminProcedure
        .input(packageDetailsSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).updateDetails(input)),
      signImage: protectedAdminProcedure
        .input(imageSignSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).signImage(input.packageId, input.name)),
      commitImage: protectedAdminProcedure
        .input(imagePathSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).commitImage(input.packageId, input.path)),
      removeImage: protectedAdminProcedure
        .input(imagePathSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).removeImage(input.packageId, input.path)),
      setCover: protectedAdminProcedure
        .input(imagePathSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).setCover(input.packageId, input.path)),
      saveHotel: protectedAdminProcedure
        .input(packageHotelSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).saveHotel(input)),
      deleteHotel: protectedAdminProcedure
        .input(packageChildRefSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).deleteHotel(input.packageId, input.rowId)),
      saveDay: protectedAdminProcedure
        .input(itineraryDaySchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).saveItineraryDay(input)),
      deleteDay: protectedAdminProcedure
        .input(packageChildRefSchema)
        .mutation(async ({ ctx, input }) =>
          (await ctx.resolve(PackageAdminService)).deleteItineraryDay(input.packageId, input.rowId)
        ),
      savePricing: protectedAdminProcedure
        .input(packagePricingSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).savePricing(input)),
      deletePricing: protectedAdminProcedure
        .input(packageChildRefSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).deletePricing(input.packageId, input.rowId)),
      setAgencies: protectedAdminProcedure
        .input(packageAgenciesSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).setAgencies(input.packageId, input.agencyIds)),
      saveDeparture: protectedAdminProcedure
        .input(departureUpsertSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).saveDeparture(input)),
      deleteDeparture: protectedAdminProcedure
        .input(departureRefSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(PackageAdminService)).deleteDeparture(input.departureId)),
    }),

    services: router({
      list: protectedAdminProcedure.query(async ({ ctx }) => (await ctx.resolve(ServiceAdminService)).listServices()),
      save: protectedAdminProcedure
        .input(serviceUpsertSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(ServiceAdminService)).saveService(input)),
      delete: protectedAdminProcedure
        .input(serviceRefSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(ServiceAdminService)).deleteService(input.serviceId)),
    }),

    requests: router({
      list: protectedAdminProcedure
        .output(z.array(submittedRequestSchema))
        .query(async ({ ctx }) => (await ctx.resolve(ServiceAdminService)).submittedRequests()),
      quote: protectedAdminProcedure
        .input(requestPriceSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(ServiceAdminService)).quote(input.bookingId, input.price)),
      decide: protectedAdminProcedure
        .input(requestDecisionSchema)
        .mutation(async ({ ctx, input }) =>
          (await ctx.resolve(ServiceAdminService)).decide(input.bookingId, input.status, input.note)
        ),
    }),

    departures: router({
      overview: protectedAdminProcedure
        .input(departuresOverviewSchema)
        .query(async ({ ctx, input }) => (await ctx.resolve(DepartureAdminService)).overview(input.from)),
      detail: protectedAdminProcedure
        .input(departureRefSchema)
        .query(async ({ ctx, input }) => (await ctx.resolve(DepartureAdminService)).detail(input.departureId)),
      releaseUnpaid: protectedAdminProcedure.mutation(async ({ ctx }) => (await ctx.resolve(DepartureAdminService)).releaseUnpaid()),
      cancel: protectedAdminProcedure
        .input(cancelDepartureSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(DepartureAdminService)).cancel(input.departureId, input.reason)),
      advance: protectedAdminProcedure
        .input(advanceDepartureSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(DepartureAdminService)).advance(input.departureId, input.stage)),
      createRoom: protectedAdminProcedure
        .input(roomCreateSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(DepartureAdminService)).createRoom(input)),
      deleteRoom: protectedAdminProcedure
        .input(roomRefSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(DepartureAdminService)).deleteRoom(input.roomId)),
      assign: protectedAdminProcedure
        .input(roomAssignSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(DepartureAdminService)).assign(input.roomId, input.target)),
      removeOccupant: protectedAdminProcedure
        .input(roomOccupantSchema)
        .mutation(async ({ ctx, input }) =>
          (await ctx.resolve(DepartureAdminService)).removeOccupant(input.roomId, input.pilgrimId)
        ),
    }),

    bookings: router({
      list: protectedAdminProcedure
        .input(umrahBookingsFilterSchema)
        .query(async ({ ctx, input }) => (await ctx.resolve(FulfillmentAdminService)).list(input)),
      filterOptions: protectedAdminProcedure.query(async ({ ctx }) => (await ctx.resolve(FulfillmentAdminService)).filterOptions()),
      detail: protectedAdminProcedure
        .input(bookingRefSchema)
        .query(async ({ ctx, input }) => (await ctx.resolve(FulfillmentAdminService)).detail(input.bookingId)),
      advanceStage: protectedAdminProcedure
        .input(advanceStageSchema)
        .mutation(async ({ ctx, input }) =>
          (await ctx.resolve(FulfillmentAdminService)).advanceStage(input.bookingId, input.stage, input.note)
        ),
      deleteDocument: protectedAdminProcedure
        .input(documentRefSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(FulfillmentAdminService)).deleteDocument(input.documentId)),
      cancel: protectedAdminProcedure
        .input(adminCancelBookingSchema)
        .mutation(async ({ ctx, input }) =>
          (await ctx.resolve(FulfillmentAdminService)).cancel(input.bookingId, input.reason, input.refundAmount)
        ),
      reviewDocument: protectedAdminProcedure
        .input(reviewDocumentSchema)
        .mutation(async ({ ctx, input }) =>
          (await ctx.resolve(FulfillmentAdminService)).reviewDocument(input.documentId, input.decision, input.note)
        ),
      saveSegment: protectedAdminProcedure
        .input(segmentUpsertSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(FulfillmentAdminService)).saveSegment(ctx.user.id, input)),
      deleteSegment: protectedAdminProcedure
        .input(segmentRefSchema)
        .mutation(async ({ ctx, input }) => (await ctx.resolve(FulfillmentAdminService)).deleteSegment(input.segmentId)),
    }),
  }),
});
