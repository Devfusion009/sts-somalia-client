import { router } from "./trpc";
import { healthRouter } from "./routers/health.router";
import { affiliatesRouter } from "../modules/affiliates/affiliates.router";
import { preferencesRouter } from "../modules/preferences/preferences.router";
import { identityRouter } from "../modules/identity/identity.router";
import { notificationsRouter } from "../modules/notifications/notifications.router";
import { ordersRouter } from "../modules/orders/orders.router";
import { travelersRouter } from "../modules/travelers/travelers.router";
import { bookingsRouter } from "../modules/bookings/bookings.router";
import { flightsRouter } from "../modules/flights/flights.router";
import { eventsRouter } from "../modules/events";
import { umrahRouter } from "../modules/umrah";
import { paymentsRouter } from "../modules/payments/payments.router";

export const appRouter = router({
  health: healthRouter,
  affiliates: affiliatesRouter,
  preferences: preferencesRouter,
  identity: identityRouter,
  notifications: notificationsRouter,
  orders: ordersRouter,
  travelers: travelersRouter,
  bookings: bookingsRouter,
  flights: flightsRouter,
  events: eventsRouter,
  umrah: umrahRouter,
  payments: paymentsRouter,
});

export type AppRouter = typeof appRouter;
