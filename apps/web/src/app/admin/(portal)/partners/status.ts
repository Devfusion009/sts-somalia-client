import type { BadgeVariant } from "@/components/ui/badge";
import type { PartnerAccountStatus } from "@/modules/admin/partner-account-shared";

/** Partner account lifecycle -> Badge variant, shared by the index and the console. */
export const ACCOUNT_STATUS_VARIANT: Record<PartnerAccountStatus, BadgeVariant> = {
  onboarding: "info",
  live: "success",
  suspended: "destructive",
  offboarded: "neutral",
};
