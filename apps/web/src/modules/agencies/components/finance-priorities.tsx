import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/** Exact counts avoid hiding an approval behind the finance tables' pagination. */
export async function FinancePriorities({ agencyId }: { agencyId?: string }) {
  const db = await createClient();
  const scope = agencyId ? "agent" : "admin";
  const definitions = [
    { table: "agency_payout_requests" as const, statuses: ["pending"], label: "Withdrawals awaiting approval", href: `/${scope}/finance/withdrawals` },
    { table: "agency_payout_requests" as const, statuses: ["approved", "processing"], label: "Withdrawals awaiting payment", href: `/${scope}/finance/withdrawals` },
    { table: "agency_topup_requests" as const, statuses: ["pending"], label: "Deposits awaiting confirmation", href: `/${scope}/finance/${agencyId ? "top-up" : "top-ups"}` },
    { table: "agency_refund_requests" as const, statuses: ["pending"], label: "Refunds awaiting approval", href: agencyId ? "/agent/refunds" : "/admin/refunds" },
  ] as const;
  const rows = await Promise.all(definitions.map(async (item) => {
    let query = db.from(item.table).select("id", { count: "exact", head: true }).in("status", item.statuses);
    if (agencyId) query = query.eq("agency_id", agencyId);
    const { count, error } = await query;
    return { ...item, count, error };
  }));
  const visible = rows.filter((row) => row.error || (row.count ?? 0) > 0);
  if (!visible.length) return null;
  return (
    <section aria-label="Finance priorities" className="space-y-3">
      <h2 className="font-heading text-base font-semibold">Finance priorities</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((row) => (
          <Link key={row.label} href={row.href} className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 text-sm hover:bg-muted/50">
            <span>{row.label}</span>
            <strong className="tabular-nums">{row.error ? "Unavailable" : row.count}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}
