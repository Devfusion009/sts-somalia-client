import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * One feed for every movement of an agency's money, merged from the four
 * places it is actually recorded: the spending wallet's ledger, the
 * commission ledger, settled payouts, and payout requests still in flight.
 *
 * These live in separate tables because they answer different questions
 * (what did we spend, what did we earn, what was transferred out), but an
 * agent asking "what happened to my money" wants one list — so the merge
 * happens here rather than making them read three screens and reconcile.
 */

export type LedgerGroup = "earning" | "withdrawal" | "wallet";

export type AgencyLedgerEntry = {
  id: string;
  group: LedgerGroup;
  /** Row label — "Commission", "Withdrawal", "Deposit", "Booking payment", … */
  type: string;
  detail: string;
  reference: string | null;
  customer: string | null;
  status: string | null;
  amount: number;
  /** Only the wallet ledger carries a running balance. */
  balanceAfter: number | null;
  createdAt: string;
  /**
   * Whether the money has actually moved. A withdrawal an admin hasn't sent
   * yet is a real row the agent should see, but it must not be counted in
   * the totals as if it had left the account.
   */
  settled: boolean;
};

const WALLET_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  booking_payment: "Booking payment",
  refund: "Refund",
  adjustment: "Adjustment",
  credit_note: "Credit note",
  debit_note: "Debit note",
};

const ENTRY_STATUS_LABELS: Record<string, string> = {
  pending: "In review",
  confirmed: "Available",
  paid_out: "Paid out",
  reversed: "Reversed",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "Requested",
  approved: "Approved",
};

const TOPUP_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting confirmation",
  rejected: "Declined",
  cancelled: "Cancelled",
  failed: "Failed",
};

const TOPUP_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  evc_plus: "EVC Plus",
  zaad: "ZAAD",
  sahal: "Sahal",
  edahab: "eDahab",
  cash_office: "Cash at office",
  card: "Card",
};

export type LedgerFilters = {
  group?: LedgerGroup;
  /** yyyy-mm-dd, inclusive. */
  from?: string;
  to?: string;
};

function withinRange(iso: string, filters: LedgerFilters) {
  const day = iso.slice(0, 10);
  if (filters.from && day < filters.from) return false;
  if (filters.to && day > filters.to) return false;
  return true;
}

export async function getAgencyLedger(agencyId: string, filters: LedgerFilters = {}): Promise<AgencyLedgerEntry[]> {
  const supabase = await createClient();

  const [walletRes, entryRes, payoutRes, requestRes, topupRes] = await Promise.all([
    supabase
      .from("agency_wallet_transactions")
      .select("id, type, amount, balance_after, note, document_number, created_at, order:order_id (order_number)")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("agency_commission_entries")
      .select(
        "id, amount, commission_amount, markup_amount, rate_applied, status, created_at, order:order_id (order_number, agency_customer:agency_customer_id (full_name))"
      )
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("agency_commission_payouts")
      .select("id, amount, method, payout_reference, paid_at")
      .eq("agency_id", agencyId)
      .order("paid_at", { ascending: false }),
    supabase
      .from("agency_payout_requests")
      .select("id, amount, status, bank_name, bank_account_number, requested_at")
      .eq("agency_id", agencyId)
      .in("status", ["pending", "approved"])
      .order("requested_at", { ascending: false }),
    // Approved top-ups are deliberately excluded: approval writes a 'deposit'
    // wallet transaction, which is already in this feed. Only the ones that
    // never became money belong here as their own row.
    supabase
      .from("agency_topup_requests")
      .select("id, amount, rail, method, status, reference, provider_ref, requested_at")
      .eq("agency_id", agencyId)
      .neq("status", "approved")
      .order("requested_at", { ascending: false }),
  ]);

  const rows: AgencyLedgerEntry[] = [];

  for (const tx of walletRes.data ?? []) {
    rows.push({
      id: `wallet-${tx.id}`,
      group: "wallet",
      type: WALLET_TYPE_LABELS[tx.type] ?? tx.type,
      detail: tx.note ?? (tx.order?.order_number ? `Order ${tx.order.order_number}` : "Wallet activity"),
      reference: tx.document_number ?? tx.order?.order_number ?? null,
      customer: null,
      status: null,
      amount: Number(tx.amount),
      balanceAfter: Number(tx.balance_after),
      createdAt: tx.created_at,
      settled: true,
    });
  }

  for (const entry of entryRes.data ?? []) {
    rows.push({
      id: `earning-${entry.id}`,
      group: "earning",
      type: "Commission",
      detail: `Commission ${entry.rate_applied}% (${Number(entry.commission_amount).toFixed(2)}) + markup (${Number(
        entry.markup_amount
      ).toFixed(2)})`,
      reference: entry.order?.order_number ?? null,
      customer: entry.order?.agency_customer?.full_name ?? null,
      status: ENTRY_STATUS_LABELS[entry.status] ?? entry.status,
      // A reversed entry never became money — carry it at zero so it stays
      // visible in the feed without distorting the totals.
      amount: entry.status === "reversed" ? 0 : Number(entry.amount),
      balanceAfter: null,
      createdAt: entry.created_at,
      settled: entry.status !== "reversed",
    });
  }

  for (const payout of payoutRes.data ?? []) {
    rows.push({
      id: `payout-${payout.id}`,
      group: "withdrawal",
      type: payout.method === "wallet" ? "Earnings to wallet" : "Withdrawal",
      detail: payout.method === "wallet" ? "Agency wallet" : payout.method ? `Transfer · ${payout.method}` : "Transfer",
      reference: payout.payout_reference ?? null,
      customer: null,
      status: "Completed",
      amount: -Number(payout.amount),
      balanceAfter: null,
      createdAt: payout.paid_at,
      settled: true,
    });
  }

  for (const request of requestRes.data ?? []) {
    rows.push({
      id: `request-${request.id}`,
      group: "withdrawal",
      type: "Withdrawal",
      detail: request.bank_name ? `Transfer · ${request.bank_name}` : "Transfer",
      reference: request.bank_account_number,
      customer: null,
      status: REQUEST_STATUS_LABELS[request.status] ?? request.status,
      amount: -Number(request.amount),
      balanceAfter: null,
      createdAt: request.requested_at,
      settled: false,
    });
  }

  for (const topup of topupRes.data ?? []) {
    rows.push({
      id: `topup-${topup.id}`,
      group: "wallet",
      type: "Top-up",
      detail: `${TOPUP_METHOD_LABELS[topup.method] ?? topup.method} · ${topup.rail}`,
      reference: topup.reference ?? topup.provider_ref,
      customer: null,
      status: TOPUP_STATUS_LABELS[topup.status] ?? topup.status,
      // Money that hasn't landed (or never will) must not move any total —
      // an approved top-up's real amount arrives as its deposit row instead.
      amount: topup.status === "pending" ? Number(topup.amount) : 0,
      balanceAfter: null,
      createdAt: topup.requested_at,
      settled: false,
    });
  }

  return rows
    .filter((row) => (filters.group ? row.group === filters.group : true))
    .filter((row) => withinRange(row.createdAt, filters))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function ledgerTotals(rows: AgencyLedgerEntry[]) {
  const settled = rows.filter((row) => row.settled);
  const moneyIn = settled.filter((r) => r.amount > 0).reduce((sum, r) => sum + r.amount, 0);
  const moneyOut = settled.filter((r) => r.amount < 0).reduce((sum, r) => sum + Math.abs(r.amount), 0);
  const inFlight = rows.filter((r) => !r.settled).reduce((sum, r) => sum + Math.abs(r.amount), 0);
  return { moneyIn, moneyOut, net: moneyIn - moneyOut, inFlight, count: rows.length };
}
