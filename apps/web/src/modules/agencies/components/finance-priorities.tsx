import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Banknote, BellRing, ClipboardList, Landmark, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/** Exact counts avoid hiding an approval behind the finance tables' pagination. */
export async function FinancePriorities({ agencyId }: { agencyId?: string }) {
  const db = await createClient();
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
  const visible = rows.filter((row) => row.error || (row.count ?? 0) > 0);
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
          <span className="tabular-nums">{total}</span> action{total === 1 ? "" : "s"} required
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
    </section>
  );
}
