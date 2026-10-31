import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations-crypto";
import { sendEmail, type EmailStatus } from "@/lib/notifications/email";
import { renderEmail, renderEmailText, type EmailContent } from "@/lib/notifications/email-layout";
import { getIntegrations } from "@/lib/integrations";
import { portalLoginHref } from "@/lib/subdomain";

type PreparedManager = { profileId: string; managerCode: string; loginEmail: string };

/** Call only after the property-scoped assignment permission check. An existing
 * customer is never promoted or given a new password by this preparation step. */
export async function prepareManagerCredentials(contactEmail: string): Promise<PreparedManager> {
  const email = contactEmail.trim().toLowerCase();
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin.from("manager_login_credentials").select("*").eq("contact_email", email).maybeSingle();
  if (lookupError) throw new Error("Manager credential storage is unavailable. Apply the manager credentials migration.");
  if (existing?.profile_id) return { profileId: existing.profile_id, managerCode: existing.manager_code, loginEmail: `${existing.id}@manager-login.scoutsts.invalid` };
  // Legacy managers keep their password and personal ID. Plain customer
  // accounts with this email are deliberately not used for a new manager.
  if (!existing) {
    const { data: legacy, error: legacyError } = await admin.from("profiles").select("id, email, manager_code")
      .eq("email", email).not("manager_code", "is", null).maybeSingle();
    if (legacyError) throw new Error("Existing manager identity could not be checked.");
    if (legacy?.manager_code) return { profileId: legacy.id, managerCode: legacy.manager_code, loginEmail: legacy.email! };
    const password = `Sts!${randomBytes(24).toString("base64url")}9a`;
    const { error } = await admin.from("manager_login_credentials").upsert({ contact_email: email, password_encrypted: encryptCredentials({ password }) }, { onConflict: "contact_email", ignoreDuplicates: true });
    if (error) throw new Error("Manager credentials could not be prepared.");
  }
  const { data: credential, error } = await admin.from("manager_login_credentials").select("*").eq("contact_email", email).single();
  if (error || !credential?.password_encrypted) throw new Error("Manager credentials could not be loaded.");
  const loginEmail = `${credential.id}@manager-login.scoutsts.invalid`;
  let { data: profile } = await admin.from("profiles").select("id").eq("email", loginEmail).maybeSingle();
  if (!profile) {
    const { data, error: createError } = await admin.auth.admin.createUser({ email: loginEmail, password: decryptCredentials(credential.password_encrypted).password, email_confirm: true,
      app_metadata: { manager_identity_id: credential.id }, user_metadata: { full_name: "Manager" } });
    if (createError || !data.user) {
      const { data: concurrent } = await admin.from("profiles").select("id").eq("email", loginEmail).maybeSingle();
      if (!concurrent) throw new Error("Manager login account could not be created.");
      profile = concurrent;
    } else profile = { id: data.user.id };
  }
  const { data: user, error: identityError } = await admin.auth.admin.getUserById(profile.id);
  if (identityError || user.user?.app_metadata.manager_identity_id !== credential.id) throw new Error("Manager login account could not be verified.");
  const { error: linkError } = await admin.from("manager_login_credentials").update({ profile_id: profile.id }).eq("id", credential.id).is("profile_id", null);
  if (linkError) throw new Error("Manager login account could not be linked.");
  const { error: profileError } = await admin.from("profiles").update({ manager_code: credential.manager_code, manager_contact_email: email }).eq("id", profile.id);
  if (profileError) throw new Error("Manager ID could not be saved.");
  return { profileId: profile.id, managerCode: credential.manager_code, loginEmail };
}

/** Assignment must succeed before a credential email can be sent. */
export async function deliverManagerCredentials(profileId: string): Promise<EmailStatus> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("manager_code").eq("id", profileId).single();
  if (!profile?.manager_code) return "failed";
  const { data: login } = await admin.rpc("manager_login_identity", { p_manager_code: profile.manager_code });
  if (!login) return "failed";
  const { data: credential, error } = await admin.from("manager_login_credentials").select("*").eq("profile_id", profileId).maybeSingle();
  if (error) return "failed";
  // Existing managers receive an ID and recovery link, never a reset of
  // their existing password merely because another seat was assigned.
  if (!credential) return sendManagerResetLink(profile.manager_code);
  if (credential.email_sent_at) return "sent";
  if (!credential.password_encrypted) return "failed";
  try {
    const password = decryptCredentials(credential.password_encrypted).password;
    const path = portalLoginHref("manager");
    const href = /^https?:/.test(path) ? path : `${getIntegrations().siteUrl}${path}`;
    const content: EmailContent = { preheader: "Your Manager Portal sign-in details.", tone: "success", paragraphs: [], label: "Manager access", heading: "Your STS Manager Portal credentials", details: [{ label: "Manager ID", value: credential.manager_code, mono: true }, { label: "Password", value: password, mono: true }], button: { label: "Sign in to the Manager Portal", href } };
    const result = await sendEmail({ to: credential.contact_email, subject: "Your STS Manager Portal credentials", html: renderEmail(content), text: renderEmailText({ ...content, textParagraphs: [] }) });
    if (result.status === "sent") {
      const { error: saveError } = await admin.from("manager_login_credentials").update({ email_sent_at: new Date().toISOString(), password_encrypted: null }).eq("id", credential.id);
      if (saveError) return "failed";
    }
    return result.status;
  } catch { return "failed"; }
}

/** A reset request does not change a password. Only the mailbox owner can finish it. */
export async function sendManagerResetLink(managerCode: string): Promise<EmailStatus> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("claim_manager_password_recovery", { p_manager_code: managerCode });
    const identity = data?.[0];
    if (!identity) return "failed";
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "recovery", email: identity.login_email });
    if (error || !link.properties?.hashed_token) return "failed";
    const url = new URL("/auth/confirm", getIntegrations().siteUrl);
    url.searchParams.set("type", "recovery"); url.searchParams.set("token_hash", link.properties.hashed_token); url.searchParams.set("next", "/reset-password");
    const content: EmailContent = { preheader: "Reset your Manager Portal password.", tone: "neutral", paragraphs: [], label: "Manager security", heading: "Reset your manager password", details: [{ label: "Manager ID", value: managerCode, mono: true }], button: { label: "Reset password", href: url.toString() } };
    return (await sendEmail({ to: identity.contact_email, subject: "Reset your STS Manager Portal password", html: renderEmail(content), text: renderEmailText({ ...content, textParagraphs: [] }) })).status;
  } catch { return "failed"; }
}
