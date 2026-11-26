"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { chargeWaafi, queryWaafiTransaction, resolveWaafiConfig, validWaafiRedirect, validWaafiSiteUrl } from "@sts/shared-types/dist/waafi-server";
import { decryptCredentials } from "@/lib/integrations-crypto";
import { paymentWorkspace, workspaceDb } from "./workspace-store";
import type { WorkspaceResult } from "./workspace-actions";

type CollectionResult = WorkspaceResult & { url?: string };
const schema = z.object({ id:z.uuid(), gateway:z.uuid(), amount:z.string().regex(/^\d{1,7}(\.\d{1,2})?$/), counterparty:z.string().trim().min(1).max(160), phone:z.string().regex(/^[1-9]\d{6,14}$/) });

export async function collectAgencyPayment(_state: CollectionResult, form: FormData): Promise<CollectionResult> {
  const owner = await paymentWorkspace("agency");
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error:"Enter an amount, customer name and international mobile number." };
  const v=input.data, amount=Math.round(Number(v.amount)*100);
  if (amount<1 || amount>100000000) return {error:"Enter an amount between $0.01 and $1,000,000."};
  const db=workspaceDb();
  const {data:g}=await db.from("agency_payment_gateways").select("*").eq("id",v.gateway).eq("agency_id",owner.agencyId!).eq("last_test_ok",true).single();
  if (!g) return {error:"Verify the agency gateway first."};
  let initial;
  try { initial=resolveWaafiConfig(decryptCredentials(g.credentials_encrypted),process.env); }
  catch { return {error:"Gateway credentials could not be read."}; }
  if (!initial) return {error:"Gateway environment does not match this site."};
  const site=process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (initial.environment === "production" && !validWaafiSiteUrl(site)) return {error:"A public HTTPS site address is required."};
  const {data:claimed,error}=await db.rpc("begin_agency_collection",{p_id:v.id,p_gateway:g.id,p_agency:owner.agencyId!,p_actor:owner.actor,p_amount:amount,p_counterparty:v.counterparty,p_phone:v.phone});
  if(error) return {error:"Payment could not be reserved. Refresh before trying again."};
  const {data:attempt}=await db.from("agency_payment_collections").select("*").eq("id",v.id).eq("agency_id",owner.agencyId!).single();
  if(!attempt) return {error:"Payment confirmation pending. Do not submit another charge."};
  let gateway;
  try { gateway=resolveWaafiConfig(decryptCredentials(attempt.credentials_encrypted),process.env); }
  catch { return {error:"Payment gateway is unavailable."}; }
  if(!gateway) return {error:"Payment gateway is unavailable."};
  if(attempt.status==="paid") return {error:null,success:"Payment received.",confirmation:{amountMinor:attempt.amount_minor,reference:attempt.transaction_id ?? attempt.id}};
  const callback=`${site.replace(/\/$/,"")}/agent/finance/payments`;
  const result=await chargeWaafi({referenceId:attempt.id,amount:attempt.amount_minor/100,currency:"USD",payerPhone:attempt.payer_phone,description:`${owner.name} payment`,successUrl:callback,cancelUrl:callback},gateway,{
    begin:async()=>({claimed:!!claimed,result:attempt.result ?? undefined}),
    save:async result=>{
      const {error:saveError}=await db.from("agency_payment_collections").update({result,...(result.type==="error"?{status:"failed" as const}:{})}).eq("id",attempt.id).eq("status","pending");
      if(saveError) throw new Error("Payment result could not be saved.");
    },
  });
  if(result.type==="success") {
    const {error:settleError}=await db.rpc("settle_agency_collection",{p_id:attempt.id,p_transaction:result.providerRef,p_amount:attempt.amount_minor,p_currency:"USD"});
    if(settleError) return {error:"Payment confirmation pending. Do not submit another charge."};
  }
  revalidatePath(owner.path);
  if(result.type==="redirect" && validWaafiRedirect(result.url,gateway.environment)) return {error:null,success:"Checkout ready.",url:result.url};
  return result.type==="error" ? {error:result.message} : result.type==="success"
    ? {error:null,success:"Payment received.",confirmation:{amountMinor:attempt.amount_minor,reference:result.providerRef}}
    : {error:null,success:"Payment confirmation pending."};
}

export async function refreshAgencyCollection(id:string):Promise<WorkspaceResult> {
  const owner=await paymentWorkspace("agency");
  if(!z.uuid().safeParse(id).success) return {error:"Invalid payment."};
  const db=workspaceDb();
  const {data:row}=await db.from("agency_payment_collections").select("*").eq("id",id).eq("agency_id",owner.agencyId!).single();
  if(!row) return {error:"Payment not found."};
  if(row.status==="paid") return {error:null,success:"Payment received.",confirmation:{amountMinor:row.amount_minor,reference:row.transaction_id ?? row.id}};
  let gateway;
  try { gateway=resolveWaafiConfig(decryptCredentials(row.credentials_encrypted),process.env); }
  catch { return {error:"Gateway is unavailable."}; }
  if(!gateway) return {error:"Gateway is unavailable."};
  const tx=await queryWaafiTransaction(id,gateway);
  if(!tx || tx.status!=="APPROVED") return {error:null,success:"Payment confirmation pending."};
  const {error}=await db.rpc("settle_agency_collection",{p_id:id,p_transaction:tx.transactionId,p_amount:Math.round(tx.amount*100),p_currency:tx.currency});
  if(error) return {error:"Payment verification failed."};
  revalidatePath(owner.path);
  return {error:null,success:"Payment received.",confirmation:{amountMinor:row.amount_minor,reference:tx.transactionId}};
}
