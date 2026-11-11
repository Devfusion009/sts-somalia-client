import Link from "next/link";
import { ArrowRight, Banknote, BellRing, Landmark, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/** Exact counts avoid hiding an approval behind the finance tables' pagination. */
export async function FinancePriorities({ agencyId }: { agencyId?: string }) {
  const db = await createClient();
  const scope = agencyId ? "agent" : "admin";
  const definitions = [
    { table: "agency_payout_requests" as const, statuses: ["pending"], label: "Withdrawals awaiting approval", icon: Landmark, href: `/${scope}/finance/withdrawals` },
    { table: "agency_payout_requests" as const, statuses: ["approved", "processing"], label: "Withdrawals awaiting payment", icon: Banknote, href: `/${scope}/finance/withdrawals` },
    { table: "agency_topup_requests" as const, statuses: ["pending"], label: "Deposits awaiting confirmation", icon: BellRing, href: `/${scope}/finance/${agencyId ? "top-up" : "top-ups"}` },
    { table: "agency_refund_requests" as const, statuses: ["pending"], label: "Refunds awaiting approval", icon: Undo2, href: agencyId ? "/agent/refunds" : "/admin/refunds" },
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
    <section aria-label="Finance priorities" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-5 text-white shadow-xl shadow-orange-500/30 ring-2 ring-amber-300/60">
      <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-white/15 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span className="relative flex size-3">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-80" />
          <span className="relative inline-flex size-3 rounded-full bg-white" />
        </span>
        <h2 className="font-heading text-xl font-bold tracking-tight">Finance priorities</h2>
        <span className="rounded-full bg-white px-3 py-0.5 text-sm font-extrabold tabular-nums text-orange-600 shadow">{total} pending</span>
      </div>
      <div className="relative mt-4 grid gap-3 sm:grid-cols-2">
        {visible.map((row) => {
          const Icon = row.icon;
          return (
            <Link key={row.label} href={row.href} className="group flex items-center gap-4 rounded-xl bg-white px-4 py-4 text-slate-900 shadow-md transition hover:-translate-y-1 hover:shadow-xl">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow">
                <Icon className="size-6" />
              </span>
              <span className="flex-1 text-base font-semibold leading-tight">{row.label}</span>
              <span className="text-3xl font-extrabold tabular-nums text-orange-600">{row.error ? "!" : row.count}</span>
              <ArrowRight className="size-5 text-orange-500 transition group-hover:translate-x-1" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
