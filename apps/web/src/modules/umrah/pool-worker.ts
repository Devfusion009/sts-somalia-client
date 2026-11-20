import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIntegrations } from "@/lib/integrations";
import { sendEmail } from "@/lib/notifications/email";
import { portalOrigin, rootOrigin } from "@/lib/subdomain";
import { poolMailIsCurrent, renderPoolEmail, type PoolMailKind, type PoolMailRequest } from "./pool-email";

type Job = {id:string;request_id:string;kind:PoolMailKind;claim_token:string};
type MailRow = PoolMailRequest & {customer_id:string};
export async function processUmrahPools() {
  const integrations = getIntegrations();
  const db = createAdminClient() as unknown as SupabaseClient;
  const checkoutExpiry = await db.rpc("release_public_umrah_checkouts");
  if (checkoutExpiry.error) throw new Error("Umrah checkout expiry failed.");
  const unpaidExpiry = await db.rpc("_expire_unpaid_umrah_orders", {});
  if (unpaidExpiry.error) throw new Error("Umrah unpaid-order expiry failed.");
  const activation = await db.rpc("process_umrah_request_pools", {p_limit:25});
  if (activation.error) throw new Error("Umrah pool activation failed.");
  const expiry = await db.rpc("expire_umrah_pool_requests");
  if (expiry.error) throw new Error("Umrah pool expiry failed.");
  const run={checkoutsReleased:checkoutExpiry.data,unpaidReleased:unpaidExpiry.data,activation:activation.data,expiry:expiry.data,sent:0,failed:0,skipped:0};
  if (!integrations.email.provider) return run;
  const claim = await db.rpc("claim_umrah_pool_emails",{p_limit:16});
  if (claim.error) throw new Error("Umrah email queue could not be claimed.");
  const jobs = (claim.data ?? []) as Job[];
  if (jobs.length === 0) return run;
  const requestsResult = await db.from("umrah_pool_requests").select("*").in("id", jobs.map(job => job.request_id));
  if (requestsResult.error) throw new Error("Umrah mail requests could not be loaded.");
  const requests = new Map((requestsResult.data ?? []).map(request => [request.id, request as MailRow]));
  const profileIds = [...new Set([...requests.values()].filter(request => !request.agency_id).map(request => request.customer_id))];
  const agencyIds = [...new Set([...requests.values()].map(request => request.agency_id).filter((id): id is string => Boolean(id)))];
  const [profilesResult, agenciesResult] = await Promise.all([
    profileIds.length ? db.from("profiles").select("id,email").in("id", profileIds) : Promise.resolve({data:[],error:null}),
    agencyIds.length ? db.from("agencies").select("id,contact_email").in("id", agencyIds) : Promise.resolve({data:[],error:null}),
  ]);
  if (profilesResult.error || agenciesResult.error) throw new Error("Umrah mail recipients could not be loaded.");
  const profiles = new Map((profilesResult.data ?? []).map(profile => [profile.id, profile.email as string]));
  const agencies = new Map((agenciesResult.data ?? []).map(agency => [agency.id, agency.contact_email as string]));
  const deliver = async (job: Job) => {
    let outcome:"sent"|"failed"|"skipped"="failed";
    let failure:string|null=null;
    try {
      const request = requests.get(job.request_id);
      if(!request) throw new Error("Request could not be loaded.");
      if(!poolMailIsCurrent(job.kind,request)) outcome="skipped";
      else {
        const email=request.agency_id ? agencies.get(request.agency_id) : profiles.get(request.customer_id);
        if(!email||email.endsWith('.invalid')) throw new Error("A deliverable recipient is required.");
        const origin=(request.agency_id ? portalOrigin("agent") : "") || rootOrigin() || integrations.siteUrl;
        if(!origin) throw new Error("Portal origin is missing.");
        const result=await sendEmail({to:email,...renderPoolEmail(job.kind,request,origin)});
        if(!result.sent) throw new Error("Email delivery failed.");
        outcome="sent";
      }
    } catch { failure="Delivery failed. Check recipient and email provider configuration."; }
    const finish=await db.rpc("finish_umrah_pool_email",{p_id:job.id,p_token:job.claim_token,p_outcome:outcome,p_error:failure});
    if(finish.error) throw new Error("Umrah email delivery state could not be recorded.");
    run[outcome]++;
  };
  for (let index = 0; index < jobs.length; index += 4) {
    await Promise.all(jobs.slice(index, index + 4).map(deliver));
  }
  return run;
}
