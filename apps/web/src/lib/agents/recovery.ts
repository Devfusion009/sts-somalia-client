"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { agentIdPattern } from "./credentials";
import { sendEmail } from "@/lib/notifications/email";
import { getIntegrations } from "@/lib/integrations";
import { escapeHtml } from "@/lib/notifications/email-layout";
import type { ActionState } from "@/lib/auth/actions";

/** Recovery is addressed to the ID's delivery contact, never to a user-supplied email. */
export async function requestAgentPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const agentId = String(formData.get("agentId") ?? "").trim().toUpperCase();
  if (!agentIdPattern.test(agentId)) return { error: "Enter a valid agent code." };
  try {
    const admin = createAdminClient();
    const { data: identities } = await admin.rpc("claim_agent_password_recovery", { p_agent_id: agentId });
    const identity = identities?.[0];
    if (!identity) return { error: null };
    const email = identity.login_email;
    const to = identity.contact_email;
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (error || !data.properties?.hashed_token) return { error: null };
    const href = new URL("/auth/confirm", getIntegrations().siteUrl);
    href.searchParams.set("token_hash", data.properties.hashed_token);
    href.searchParams.set("type", "recovery");
    href.searchParams.set("next", "/reset-password");
    await sendEmail({ to, subject: "Reset your STS Agent Portal password", text: `Agent Code: ${agentId}\nReset your password: ${href}`, html: `<p>Agent Code: ${escapeHtml(agentId)}</p><p><a href="${escapeHtml(href.toString())}">Reset agent password</a></p>` });
  } catch { /* A missing ID and a delivery failure have the same public response. */ }
  return { error: null };
}
