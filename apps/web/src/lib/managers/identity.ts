import { portalLoginHref } from "@/lib/subdomain";
export const managerIdPattern = /^MGR-\d{4}-\d{6,}$/;
export function managerRecoveryHref() { return portalLoginHref("manager").replace(/\/login$/, "/forgot-password"); }
