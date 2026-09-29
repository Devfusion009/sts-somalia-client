import "server-only";
import { redirect } from "next/navigation";
import { deniedDestination, requirePlatformAdmin } from "@/lib/auth/session";
import { type VisaPermission, visaStaffCan } from "./permissions";

/** Server-side gate for every visa staff action and page. */
export async function requireVisaPermission(perm: VisaPermission) {
  const profile = await requirePlatformAdmin();
  if (!visaStaffCan(profile, perm)) redirect(deniedDestination());
  return profile;
}
