import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceDatabase } from "@sts/shared-types/dist/payment-workspace";
import { queryWaafiTransaction, resolveWaafiConfig } from "@sts/shared-types/dist/waafi-server";
import { createAdminClient } from "../../infra/supabase/supabase-clients";
import { decryptCredentials } from "../../infra/provider-credentials/crypto";
import { env } from "../../config/env";

@Injectable()
export class AgencyCollectionsService {
  private running=false;
  private readonly logger=new Logger(AgencyCollectionsService.name);
  @Interval(60_000)
  async reconcile() {
    if(this.running) return;
    this.running=true;
    try {
      const db=createAdminClient() as unknown as SupabaseClient<WorkspaceDatabase>;
      const {data,error}=await db.from("agency_payment_collections").select("*").eq("status","pending")
        .lt("created_at",new Date(Date.now()-30_000).toISOString()).order("checked_at",{ascending:true,nullsFirst:true}).limit(5);
      if(error) throw error;
      for(const row of data ?? []) {
        try {
          const {error:visitError}=await db.from("agency_payment_collections").update({checked_at:new Date().toISOString()}).eq("id",row.id);
          if(visitError) continue;
          const gateway=resolveWaafiConfig(decryptCredentials(row.credentials_encrypted),env());
          if(!gateway) continue;
          const tx=row.result?.type==="success"
            ? {status:"APPROVED",transactionId:row.result.providerRef,amount:row.amount_minor/100,currency:"USD"}
            : await queryWaafiTransaction(row.id,gateway);
          if(tx?.status==="APPROVED") {
            const {error:settleError}=await db.rpc("settle_agency_collection",{p_id:row.id,p_transaction:tx.transactionId,p_amount:Math.round(tx.amount*100),p_currency:tx.currency});
            if(settleError) throw settleError;
          } else if(tx && ["FAILED","CANCELLED","EXPIRED"].includes(tx.status)) {
            await db.from("agency_payment_collections").update({status:"failed"}).eq("id",row.id).eq("status","pending");
          }
        } catch { this.logger.warn(`Agency payment needs reconciliation: ${row.id}`); }
      }
    } catch { this.logger.warn("Agency payment reconciliation unavailable."); }
    finally {this.running=false;}
  }
}
