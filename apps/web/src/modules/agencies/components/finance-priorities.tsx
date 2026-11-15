import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Banknote, BellRing, Building2, ClipboardList, FileSearch, Landmark, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPaymentPriorities } from "@/modules/admin/payment-priorities";
import { formatDistanceToNow } from "date-fns";

/** Exact counts avoid hiding an approval behind the finance tables' pagination. */
export async function FinancePriorities({ agencyId }: { agencyId?: string }) {
  const db = await createClient();
  const paymentsPromise = agencyId ? Promise.resolve(null) : getPaymentPriorities();
  const scope = agencyId ? "agent" : "admin";
  const definitions = [
    { table: "agency_payout_requests" as const, statuses: ["pending"], label: "Withdrawals awaiting approval", action: "Review", tone: "var(--brand-gold)", icon: Landmark, href: `/${scope}/finance/withdrawals` },
    { table: "agency_payout_requests" as const, statuses: ["approved", "processing"], label: "Withdrawals awaiting payment", action: "Track", tone: "var(--chart-3)", icon: Banknote, href: `/${scope}/finance/withdrawals` },
    { table: "agency_topup_requests" as const, statuses: ["pending"], label: "Deposits awaiting confirmation", action: "View", tone: "var(--chart-4)", icon: BellRing, href: `/${scope}/finance/${agencyId ? "top-up" : "top-ups"}` },
    { table: "agency_refund_requests" as const, statuses: ["pending"], label: "Refunds awaiting approval", action: "Review", tone: "var(--chart-2)", icon: Undo2, href: agencyId ? "/agent/refunds" : "/admin/refunds" },
  ] as const;
  const rows = await Promise.all(definitions.map(async (item) => {
    let query = db.from(item.table).select("id", { count: "exact", head: true }).in("status", item.statuses);
    if (agencyId) query = query.eq("agency_id", agencyId);
    const { count, error } = await query;
    return { ...item, count, error };
  }));
  const payments = await paymentsPromise;
  const paymentRows = payments ? [
    { label: "Bank transfer proofs awaiting review", action: "Review transfers", tone: "var(--brand-gold)", icon: FileSearch, href: "/admin/orders?filter=action", count: payments.bank.count, error: payments.bank.error },
    { label: "Office payments awaiting cash collection", action: "View cash requests", tone: "var(--chart-3)", icon: Building2, href: "/admin/orders?filter=action", count: payments.cash.count, error: payments.cash.error },
  ] : [];
  const visible = [...paymentRows, ...rows].filter((row) => row.error || (row.count ?? 0) > 0);
  if (!visible.length) return null;
  const total = visible.reduce((sum, row) => sum + (row.count ?? 0), 0);
  return (
    <section aria-labelledby="finance-priorities-title" className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-16px_rgb(0_0_0/0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-gold)] to-[color-mix(in_oklch,var(--brand-gold),var(--chart-2)_55%)] text-white shadow-[0_6px_16px_-8px_var(--brand-gold)]">
            <ClipboardList className="size-5" aria-hidden="true" />
            <span className="absolute -right-1 -top-1 flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--chart-2)] opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-3 rounded-full border-2 border-card bg-[var(--chart-2)]" />
            </span>
          </span>
          <h2 id="finance-priorities-title" className="font-heading text-lg font-semibold tracking-tight">Pending tasks</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklch,var(--brand-gold)_40%,var(--border))] bg-[color-mix(in_oklch,var(--brand-gold)_10%,var(--card))] px-3 py-1 text-xs font-semibold text-[color-mix(in_oklch,var(--brand-gold),black_40%)] dark:text-brand-gold">
          {visible.some(row => row.error) ? "Some queues unavailable" : <><span className="tabular-nums">{total}</span> action{total === 1 ? "" : "s"} required</>}
        </span>
      </div>
      <ul className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
        {visible.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.label} className="min-w-0">
              <Link
                href={row.href}
                style={{ "--tone": row.tone } as CSSProperties}
                className="group relative flex h-full items-center gap-4 overflow-hidden rounded-xl border border-[color-mix(in_oklch,var(--tone)_25%,var(--border))] bg-[color-mix(in_oklch,var(--tone)_5%,var(--card))] py-4 pl-5 pr-4 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--tone)] hover:shadow-[0_12px_28px_-18px_var(--tone)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--tone)]" />
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--tone)_15%,var(--card))] text-[color-mix(in_oklch,var(--tone),black_20%)] dark:text-[var(--tone)]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-foreground">{row.error ? `${row.label} unavailable` : row.label}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[color-mix(in_oklch,var(--tone),black_30%)] dark:text-[var(--tone)]">
                    {row.action}<ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </span>
                <span className="font-heading text-3xl font-semibold leading-none tabular-nums text-foreground">{row.error ? "—" : row.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {payments && (payments.bank.rows.length > 0 || payments.cash.rows.length > 0) ? (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">Payments to follow up</h3>
          <ul className="mt-3 divide-y divide-border">
            {[...payments.bank.rows.map(row => ({ ...row, bank: true })), ...payments.cash.rows.map(row => ({ ...row, bank: false }))].map(row => (
              <li key={row.id}>
                <Link href={`/admin/orders?order=${row.order_id}#order-${row.order_id}`} className="group flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg px-2 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300">{row.bank ? <Landmark className="size-4" aria-hidden="true" /> : <Building2 className="size-4" aria-hidden="true" />}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{row.order.order_number}<span className="ml-2 font-normal text-muted-foreground">{row.order.agency_customer?.full_name ?? row.order.customer?.full_name ?? "Customer"}</span></span><span className="mt-1 block text-xs break-words text-muted-foreground">{row.bank ? "Bank transfer · Proof ready for review" : "Pay at Office · Awaiting cash collection"}{row.bank && row.proofs?.[0]?.transfer_reference ? ` · Ref: ${row.proofs[0].transfer_reference}` : ""}</span></span>
                  <span className="text-right"><span className="block text-sm font-semibold tabular-nums">{new Intl.NumberFormat("en-US", { style: "currency", currency: row.currency }).format(Number(row.amount))}</span><span className="mt-1 block text-xs text-muted-foreground">Requested {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}</span></span>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary">{row.bank ? "Review proof" : "Open cash request"}<ArrowRight className="size-4" aria-hidden="true" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
