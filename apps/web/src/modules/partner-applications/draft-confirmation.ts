import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftFields } from "./draft-fields";
import type { ApplicationKind } from "./config";

/** Called only after the authenticated step action validates and persists. */
export async function confirmDraft(owner:string,kind:ApplicationKind,id:string,step:number,form:FormData) {
  const db=createAdminClient() as unknown as SupabaseClient<{public:{Tables:Record<never,never>;Views:Record<never,never>;Functions:{confirm_partner_application_draft:{Args:{p_owner:string;p_kind:string;p_id:string;p_step:number;p_fields:Record<string,string>};Returns:undefined}}}}>;
  const {error}=await db.rpc("confirm_partner_application_draft",{p_owner:owner,p_kind:kind,p_id:id,p_step:step,p_fields:draftFields(kind,step,Object.fromEntries(form))});
  return !error;
}
