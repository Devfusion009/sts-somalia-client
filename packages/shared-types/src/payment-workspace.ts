import type { WaafiResult } from "./waafi-server";
export type AgencyCollection = { id:string;agency_id:string;gateway_id:string;credentials_encrypted:string;environment:string;amount_minor:number;counterparty:string;payer_phone:string;status:"pending"|"paid"|"failed";result:WaafiResult|null;transaction_id:string|null;created_by:string;created_at:string;checked_at:string|null };
export type CashEntry = {
  id: string; agency_id: string | null; direction: "in" | "out"; kind: "transfer" | "refund";
  amount_minor: number; currency: string; method: string; counterparty: string;
  external_reference: string; original_id: string | null; recorded_by: string; created_at: string;
};
export type AgencyGateway = {
  id: string; agency_id: string; provider: string; environment: string; credentials_encrypted: string;
  version: string; last_test_ok: boolean | null; last_tested_at: string | null; updated_by: string; updated_at: string;
};
type Table<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
export type WorkspaceDatabase = { public: {
  Tables: { payment_cashbook: Table<CashEntry>; agency_payment_gateways: Table<AgencyGateway>; agency_payment_collections: Table<AgencyCollection> };
  Views: Record<never, never>;
  Functions: {
    begin_agency_collection: { Args: {p_id:string;p_gateway:string;p_agency:string;p_actor:string;p_amount:number;p_counterparty:string;p_phone:string}; Returns:boolean };
    settle_agency_collection: { Args: {p_id:string;p_transaction:string;p_amount:number;p_currency:string}; Returns:undefined };
    record_cashbook_entry: { Args: {
    p_id: string; p_agency_id: string | null; p_direction: string; p_kind: string; p_amount_minor: number;
    p_method: string; p_counterparty: string; p_reference: string; p_original_id: string | null; p_actor: string;
  }; Returns: string } };
} };
