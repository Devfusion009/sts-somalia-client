import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { portalHref } from "@/lib/subdomain";

/**
 * The B2C surface of /account. An approved agent's role fully replaces
 * "customer" — the client's requirement is that an agency application's
 * approval converts the account rather than adding a second hat — so none
 * of this is theirs any more. Orders placed before the conversion are
 * surfaced read-only at /agent/personal-bookings.
 *
 * This guard sits on the route group rather than on account/layout.tsx so
 * that /account/become stays reachable: it is the partner-application
 * tracker, not a shopping surface, and an agent may still apply to a
 * second programme (hotel partner, venue partner) or re-apply after a
 * membership lapses. Guarding the whole of /account trapped a
 * membership-less agent in a redirect loop against the agent portal's own
 * "apply" card.
 */
export default async function CustomerAccountLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  if (profile.role === "agent") redirect(portalHref("agent"));
  return children;
}
