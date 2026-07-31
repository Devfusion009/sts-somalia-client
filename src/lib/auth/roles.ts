import type { AppRole } from "@/lib/auth/session";

export const PORTAL_BY_ROLE: Partial<Record<AppRole, { href: string; label: string }>> = {
  agent: { href: "/agent", label: "Agent Portal" },
  hotel_partner: { href: "/partner", label: "Partner Portal" },
  affiliate: { href: "/affiliate", label: "Affiliate Dashboard" },
  admin: { href: "/admin", label: "Admin Dashboard" },
};

export function portalForRole(role: AppRole) {
  return PORTAL_BY_ROLE[role] ?? null;
}
