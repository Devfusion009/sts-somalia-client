import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin, requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";

export type PaymentScope = "sts" | "agency";
import type { WorkspaceDatabase } from "@sts/shared-types/dist/payment-workspace";
/** Typed extension for the accompanying migration; never exposed to clients. */
export const workspaceDb = () => createAdminClient() as unknown as SupabaseClient<WorkspaceDatabase>;

export async function paymentWorkspace(scope: PaymentScope) {
  if (scope === "sts") {
    const profile = await requirePlatformAdmin();
    return { agencyId: null, actor: profile.id, name: "STS", path: "/admin/finance/payments" };
  }
  if (scope !== "agency") throw new Error("Invalid payment workspace.");
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership || membership.roleInAgency !== "owner" || membership.agency.status !== "active") {
    throw new Error("An active agency owner account is required.");
  }
  return { agencyId: membership.agency.id, actor: profile.id, name: membership.agency.name, path: "/agent/finance/payments" };
}
