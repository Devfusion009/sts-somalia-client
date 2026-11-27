import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations-crypto";

export const agentIdPattern = /^AGT-\d{4}-\d{6,}$/;

/** Stage once per application. Retries reuse the identity and password, including
 * after a timeout between Auth user creation and saving its profile ID. */
export async function prepareAgentCredentials(applicationId: string, contactEmail: string | null, fullName: string | null) {
  const email = z.string().email().safeParse(contactEmail?.trim());
  if (!email.success) throw new Error("Enter a valid application contact email before approval.");
  const admin = createAdminClient();
  const { data: application, error: applicationError } = await admin.from("agency_applications")
    .select("status").eq("id", applicationId).single();
  if (applicationError || !application) throw new Error("Application could not be loaded.");
  const { data: existing, error: lookupError } = await admin.from("agent_login_credentials")
    .select("*").eq("application_id", applicationId).maybeSingle();
  if (lookupError) throw new Error("Agent credential storage is unavailable. Apply the agent credentials migration.");
  if (existing?.approved_at) return existing;
  if (!["pending", "under_review"].includes(application.status)) throw new Error("Application is not awaiting approval.");

  if (!existing) {
    if (!process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim()) {
      throw new Error("Agent credential storage is not configured. Contact the system administrator.");
    }
    const password = `Sts!${randomBytes(24).toString("base64url")}9a`;
    const passwordEncrypted = encryptCredentials({ password });
    const { error } = await admin.from("agent_login_credentials").upsert({
      application_id: applicationId,
      login_email: `application-${applicationId}@agent-login.scoutsts.invalid`,
      contact_email: email.data,
      password_encrypted: passwordEncrypted,
    }, { onConflict: "application_id", ignoreDuplicates: true });
    if (error) throw new Error("Agent credentials could not be prepared.");
  }
  const { data: credential, error: readError } = await admin.from("agent_login_credentials")
    .select("*").eq("application_id", applicationId).single();
  if (readError || !credential?.password_encrypted) throw new Error("Agent credentials could not be loaded.");
  // A corrected contact address before approval also becomes the delivery address.
  if (credential.contact_email !== email.data) {
    const { error } = await admin.from("agent_login_credentials").update({ contact_email: email.data })
      .eq("application_id", applicationId).is("approved_at", null);
    if (error) throw new Error("Credential delivery address could not be saved.");
    credential.contact_email = email.data;
  }
  if (credential.profile_id) return credential;

  let { data: profile } = await admin.from("profiles").select("id")
    .eq("email", credential.login_email).maybeSingle();
  if (!profile) {
    const { data, error } = await admin.auth.admin.createUser({
      email: credential.login_email,
      password: decryptCredentials(credential.password_encrypted).password,
      email_confirm: true,
      app_metadata: { agent_application_id: applicationId },
      user_metadata: { full_name: fullName ?? "Agency owner" },
    });
    if (error || !data.user) {
      // Another request may have created this exact identity concurrently.
      const { data: concurrent } = await admin.from("profiles").select("id")
        .eq("email", credential.login_email).maybeSingle();
      if (!concurrent) throw new Error("Agent login account could not be created.");
      profile = concurrent;
    } else profile = { id: data.user.id };
  }
  const { data: identity, error: identityError } = await admin.auth.admin.getUserById(profile.id);
  if (identityError || identity.user?.app_metadata.agent_application_id !== applicationId) {
    throw new Error("Agent login account could not be verified.");
  }
  const { error: saveError } = await admin.from("agent_login_credentials")
    .update({ profile_id: profile.id }).eq("application_id", applicationId).is("profile_id", null);
  if (saveError) throw new Error("Agent login account could not be linked.");
  return { ...credential, profile_id: profile.id };
}

/** A saved delivery record overrides status parameters from an old approval URL. */
export function agentCredentialEmailStatus(
  delivery: { approved_at: string | null; email_sent_at: string | null } | null,
  reportedStatus?: string,
) {
  return delivery?.approved_at ? delivery.email_sent_at ? "sent" : "pending" : reportedStatus;
}

/** Safe delivery metadata for the admin console. Never returns a password or alias. */
export async function getAgentCredentialDelivery(applicationId: string) {
  const { data, error } = await createAdminClient().from("agent_login_credentials")
    .select("agent_id, contact_email, email_sent_at, approved_at").eq("application_id", applicationId).maybeSingle();
  if (error) return null; // Older deployments can still render existing partner accounts.
  return data;
}
