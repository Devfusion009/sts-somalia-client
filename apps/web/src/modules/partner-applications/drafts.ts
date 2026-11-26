"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { draftFields } from "./draft-fields";
import { getEditableApplication } from "./queries";

export type DraftRow = { applicant_id: string; kind: string; application_id: string; step: number; fields: Record<string,string>; revision: number; saved_at: string; confirmed_fields: Record<string,string>|null };
type DraftDatabase = { public: { Tables: { partner_application_drafts: { Row: DraftRow; Insert: Partial<DraftRow>; Update: Partial<DraftRow>; Relationships: [] } }; Views: Record<never,never>; Functions: { save_partner_application_draft: { Args: { p_kind:string;p_id:string;p_step:number;p_fields:Record<string,string>;p_revision:number }; Returns:number } } } };

export async function getApplicationDrafts(kind: string, id: string): Promise<DraftRow[]> {
  const user = await requireUser();
  const db = await createClient() as unknown as SupabaseClient<DraftDatabase>;
  const { data } = await db.from("partner_application_drafts").select("*").eq("applicant_id",user.id).eq("kind",kind).eq("application_id",id);
  return data ?? [];
}

const schema = z.object({ kind:z.enum(["agency","affiliate","hotel_partner","venue_partner"]), id:z.uuid(), step:z.number().int().min(1).max(4), revision:z.number().int().min(0), fields:z.record(z.string(),z.string().max(20000)) });
export async function saveApplicationDraft(input: unknown): Promise<{ revision?:number; savedAt?:number; error?:string; conflict?:boolean }> {
  const parsed=schema.safeParse(input);
  if(!parsed.success || JSON.stringify(input).length>100000) return {error:"Draft is too large or invalid."};
  const {kind,id,step,revision,fields}=parsed.data;
  const user=await requireUser();
  const {application}=await getEditableApplication(kind,id,user.id);
  if(!application) return {error:"This application can no longer be edited."};
  const db=await createClient() as unknown as SupabaseClient<DraftDatabase>;
  const {data,error}=await db.rpc("save_partner_application_draft",{p_kind:kind,p_id:id,p_step:step,p_revision:revision,p_fields:draftFields(kind,step,fields)});
  if(error) return {error:error.code==="40001"?"Draft changed on another device.":"Draft sync unavailable.",conflict:error.code==="40001"};
  return {revision:data,savedAt:Date.now()};
}
