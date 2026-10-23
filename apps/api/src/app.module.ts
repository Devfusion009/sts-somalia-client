import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { validateEnv } from "./config/env";
import { SupabaseModule } from "./infra/supabase/supabase.module";
import { RedisModule } from "./infra/redis/redis.module";
import { HealthModule } from "./health/health.module";
import { AffiliatesModule } from "./modules/affiliates/affiliates.module";
import { PreferencesModule } from "./modules/preferences/preferences.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { TravelersModule } from "./modules/travelers/travelers.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { FlightsModule } from "./modules/flights/flights.module";
import { EventsModule } from "./modules/events";
import { UmrahModule } from "./modules/umrah";
import { PaymentsModule } from "./modules/payments/payments.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // No jobs registered yet — this is the shape that later replaces
    // apps/web's Vercel Cron + admin-layout page-load fallback with a real
    // in-process @Cron() on this always-on service.
    ScheduleModule.forRoot(),
    SupabaseModule,
    RedisModule,
    HealthModule,
    AffiliatesModule,
    PreferencesModule,
    IdentityModule,
    NotificationsModule,
    OrdersModule,
    TravelersModule,
    BookingsModule,
    FlightsModule,
    EventsModule,
    UmrahModule,
    PaymentsModule,
  ],
})
export class AppModule {}
