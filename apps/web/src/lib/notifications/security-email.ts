import "server-only";
import { portalHref } from "@/lib/subdomain";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./email";
import { getIntegrations } from "@/lib/integrations";
import { renderEmail } from "./email-layout";

export type SecurityEmailKind =
  | "new_sign_in"
  | "password_changed"
  | "mfa_enabled"
  | "mfa_disabled"
  | "recovery_code_used";

const SUBJECT: Record<SecurityEmailKind, string> = {
  new_sign_in: "New sign-in to your STS account",
  password_changed: "Your STS password was changed",
  mfa_enabled: "Two-factor authentication is on",
  mfa_disabled: "Two-factor authentication is off",
  recovery_code_used: "A recovery code was used on your STS account",
};

/**
 * Security notice after a sign-in from a new device or a change to the
 * account's credentials. States what happened, when and from where, and links
 * to the security page. Best-effort: a failed send never fails the change.
 */
export async function sendSecurityEmail(input: {
  to: string;
  kind: SecurityEmailKind;
  device: string;
  location: string | null;
  ip: string | null;
  at?: Date;
}): Promise<void> {
  const { siteUrl } = getIntegrations();
  const portal = input.to.endsWith("@manager-login.scoutsts.invalid") ? "manager" : input.to.endsWith("@agent-login.scoutsts.invalid") ? "agent" : null;
  const path = portal ? `${portalHref(portal)}/security` : "/account/security";
  const securityUrl = /^https?:/.test(path) ? path : `${siteUrl}${path}`;
  const when = (input.at ?? new Date()).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
  const details = [
    { label: "When", value: when },
    { label: "Device", value: input.device },
    ...(input.location ? [{ label: "Location", value: input.location }] : []),
    ...(input.ip ? [{ label: "IP address", value: input.ip, mono: true }] : []),
  ];
  const html = renderEmail({
    preheader: "If this wasn't you, change your password and sign out of other devices.",
    label: "Security alert",
    tone: input.kind === "new_sign_in" || input.kind === "password_changed" || input.kind === "mfa_enabled" ? "neutral" : "warning",
    heading: SUBJECT[input.kind],
    paragraphs: [],
    details,
    button: { label: "Review account security", href: securityUrl },
    audience: portal === "agent" ? "Agent Portal" : portal === "manager" ? "Partner Portal" : "Account security",
  });
  try {
    let to = input.to;
    if (to.endsWith("@agent-login.scoutsts.invalid")) {
      const { data } = await createAdminClient().from("agent_login_credentials")
        .select("contact_email").eq("login_email", to).not("approved_at", "is", null).maybeSingle();
      if (!data) return;
      to = data.contact_email;
    }
    if (to.endsWith("@manager-login.scoutsts.invalid")) {
      const { data } = await createAdminClient().from("manager_login_credentials").select("contact_email").eq("id", to.split("@")[0]).maybeSingle();
      if (!data) return;
      to = data.contact_email;
    }
    await sendEmail({ to, subject: SUBJECT[input.kind], html });
  } catch {
    // Never fail the security change on a notification error.
  }
}
