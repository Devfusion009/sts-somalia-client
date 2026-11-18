import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegrations } from "@/lib/integrations";
import { sendEmail } from "@/lib/notifications/email";
import { portalOrigin, rootOrigin } from "@/lib/subdomain";
import { poolMailIsCurrent, renderPoolEmail, type PoolMailKind, type PoolMailRequest } from "./pool-email";

type Job = {id:string;request_id:string;kind:PoolMailKind;claim_token:string};
export async function processUmrahPools() {
  const integrations = getIntegrations();
  const db = createAdminClient() as unknown as SupabaseClient;
  const activation = await db.rpc("process_umrah_request_pools", {p_limit:25});
  if (activation.error) throw new Error("Umrah pool activation failed.");
  const expiry = await db.rpc("expire_umrah_pool_requests");
  if (expiry.error) throw new Error("Umrah pool expiry failed.");
  const run={activation:activation.data,expiry:expiry.data,sent:0,failed:0,skipped:0};
  if (!integrations.email.provider) return run;
  const claim = await db.rpc("claim_umrah_pool_emails",{p_limit:25});
  if (claim.error) throw new Error("Umrah email queue could not be claimed.");
  for (const job of (claim.data ?? []) as Job[]) {
    let outcome:"sent"|"failed"|"skipped"="failed";
    let failure:string|null=null;
    try {
      const {data:r,error}=await db.from("umrah_pool_requests").select("*").eq("id",job.request_id).single();
      if(error||!r) throw new Error("Request could not be loaded.");
      if(!poolMailIsCurrent(job.kind,r as PoolMailRequest)) outcome="skipped";
      else {
        const recipient = r.agency_id
          ? await db.from("agencies").select("contact_email").eq("id",r.agency_id).single()
          : await db.from("profiles").select("email").eq("id",r.customer_id).single();
        const email=recipient.data && ("contact_email" in recipient.data ? recipient.data.contact_email : recipient.data.email);
        if(recipient.error||!email||email.endsWith('.invalid')) throw new Error("A deliverable recipient is required.");
        const origin=(r.agency_id ? portalOrigin("agent") : "") || rootOrigin() || integrations.siteUrl;
        if(!origin) throw new Error("Portal origin is missing.");
        const result=await sendEmail({to:email,...renderPoolEmail(job.kind,r as PoolMailRequest,origin)});
        if(!result.sent) throw new Error("Email delivery failed.");
        outcome="sent";
      }
    } catch { failure="Delivery failed. Check recipient and email provider configuration."; }
    const finish=await db.rpc("finish_umrah_pool_email",{p_id:job.id,p_token:job.claim_token,p_outcome:outcome,p_error:failure});
    if(finish.error) throw new Error("Umrah email delivery state could not be recorded.");
    run[outcome]++;
  }
  return run;
}
