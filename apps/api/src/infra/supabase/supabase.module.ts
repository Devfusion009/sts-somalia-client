import { Global, Module } from "@nestjs/common";
import { RlsSupabaseService } from "./rls-supabase.service";
import { AdminSupabaseService } from "./admin-supabase.service";

@Global()
@Module({
  providers: [RlsSupabaseService, AdminSupabaseService],
  exports: [RlsSupabaseService, AdminSupabaseService],
})
export class SupabaseModule {}
