import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PLATFORM_ADMIN = "requirePlatformAdmin";

/**
 * Marks a route as admin-only. Must be combined with SupabaseAuthGuard +
 * RolesGuard (in that order) via @UseGuards — RolesGuard reads this
 * metadata to decide whether to check profiles.is_platform_admin.
 */
export const RequirePlatformAdmin = () => SetMetadata(REQUIRE_PLATFORM_ADMIN, true);
