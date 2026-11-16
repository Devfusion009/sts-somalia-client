import { z } from "zod";
import { router, protectedProcedure, protectedAdminProcedure } from "../../trpc/trpc";
import { sendBroadcastSchema } from "@sts/shared-types";
import { NotificationsService } from "./notifications.service";

export const notificationsRouter = router({
  adminNavCounts: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(NotificationsService);
    return svc.getAdminNavCounts();
  }),
  unreadOrderCount: protectedProcedure.query(async ({ ctx }) => {
    const svc = await ctx.resolve(NotificationsService);
    return svc.getUnreadOrderCount(ctx.user!.id);
  }),

  readOrder: protectedProcedure.input(z.object({ orderId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(NotificationsService);
    return svc.readOrder(ctx.user!.id, input.orderId);
  }),

  unread: protectedProcedure
    .input(z.object({ type: z.string().optional(), limit: z.number().int().min(1).max(100).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const svc = await ctx.resolve(NotificationsService);
      return svc.getUnread(ctx.user!.id, input);
    }),

  dismiss: protectedProcedure.input(z.object({ notificationId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(NotificationsService);
    return svc.dismiss(ctx.user!.id, input.notificationId);
  }),

  dismissType: protectedProcedure.input(z.object({ type: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(NotificationsService);
    return svc.dismissType(ctx.user!.id, input.type);
  }),

  admin: router({
    sendBroadcast: protectedAdminProcedure.input(sendBroadcastSchema).mutation(async ({ ctx, input }) => {
      const svc = await ctx.resolve(NotificationsService);
      return svc.sendBroadcast(ctx.user!.id, input);
    }),

    broadcastHistory: protectedAdminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const svc = await ctx.resolve(NotificationsService);
        return svc.getBroadcastHistory(input?.limit);
      }),
  }),
});
