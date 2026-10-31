import "server-only";
import { portalHref } from "@/lib/subdomain";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./email";
import { getIntegrations } from "@/lib/integrations";

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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

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
  const rows = [
    ["When", when],
    ["Device", input.device],
    ...(input.location ? [["Location", input.location]] : []),
    ...(input.ip ? [["IP address", input.ip]] : []),
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;">${label}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a2e29;">
      <h1 style="color: #00947c; font-size: 20px;">${SUBJECT[input.kind]}</h1>
      <table style="margin:16px 0;border-collapse:collapse;font-size:14px;">${rows}</table>
      <p>If this wasn't you, change your password and sign out of other devices.</p>
      <p><a href="${escapeHtml(securityUrl)}" style="background:#00947c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Review account security</a></p>
      <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
        STS Somalia &middot; Sultan Business Park, Waaberi District, 21 Oct Street, Muqdisho
      </p>
    </div>`;
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
