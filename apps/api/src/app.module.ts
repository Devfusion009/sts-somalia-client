import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { SupabaseModule } from "./infra/supabase/supabase.module";
import { RedisModule } from "./infra/redis/redis.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // No jobs registered yet — this is the shape that later replaces
    // apps/web's Vercel Cron + admin-layout page-load fallback with a real
    // in-process @Cron() on this always-on service.
    ScheduleModule.forRoot(),
    SupabaseModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
