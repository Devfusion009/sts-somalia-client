import { portalLoginHref } from "@/lib/subdomain";

export function agentRecoveryHref() {
  return portalLoginHref("agent").replace(/\/login$/, "/forgot-password");
}
