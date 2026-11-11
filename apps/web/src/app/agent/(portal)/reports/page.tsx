import { AgentMoney } from "@/components/portal/agent-money";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import { Banknote, CalendarDays, CircleCheck, Clock3, Download, FileText, Receipt, Wallet, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyAgency,
  getAgencyCommissionEntries,
  getAgencyCommissionPayouts,
  getAgencyCommissionReport,
  getAgencyEarningsSummary,
  type AgencyCommissionEntry,
} from "@/modules/agencies/queries";
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { cn } from "@/lib/utils";
import { money } from "@/lib/money";
import { parsePage } from "@/lib/pagination";
import { Pager } from "@/components/dashboard/pager";
import { ReportFilters } from "./report-filters";
import type { Database } from "@/lib/types/database.types";

export const metadata: Metadata = { title: "Commissions & earnings" };

type OrderItemType = Database["public"]["Enums"]["order_item_type"];

const VERTICAL_LABELS: Record<OrderItemType, string> = {
  hotel: "Hotels",
  flight: "Flights",
  visa: "Visa",
  umrah: "Umrah",
  hall: "Events & Halls",
};

const ENTRY_STATUS_VARIANT: Partial<Record<string, BadgeVariant>> = {
  paid_out: "neutral",
  reversed: "destructive",
};

// The same four words the Finance Overview pipeline uses — an agent should
// never have to map "confirmed" here onto "available to withdraw" there.
const ENTRY_STATUS_LABELS: Record<string, string> = {
  pending: "In review",
  confirmed: "Available",
  paid_out: "Paid out",
  reversed: "Reversed",
};

const usd = (amount: number) => money(amount, "USD");

type EntryStatus = Database["public"]["Enums"]["commission_entry_status"];
const VIEWS = {
  total: { title: "All earnings", statuses: ["pending", "confirmed", "paid_out"] as EntryStatus[] },
  month: { title: "Earned this month", statuses: ["pending", "confirmed", "paid_out"] as EntryStatus[] },
  review: { title: "In review by STS", statuses: ["pending"] as EntryStatus[] },
  available: { title: "Available to withdraw", statuses: ["confirmed"] as EntryStatus[] },
} as const;
type ViewKey = keyof typeof VIEWS;

export default async function AgentReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string; page?: string; view?: string }>;
}) {
  const { from, to, type, page: pageParam, view: viewParam } = await searchParams;
  const view = viewParam && viewParam in VIEWS ? (viewParam as ViewKey) : undefined;
  const itemType =
    type && type in VERTICAL_LABELS ? (type as OrderItemType) : undefined;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const page = parsePage(pageParam);
  const filters = { from, to, itemType };
  const entryFilters = {
    ...filters,
    ...(view === "month" ? { from: startOfMonth(new Date()).toISOString() } : {}),
    statuses: view ? [...VIEWS[view].statuses] : undefined,
  };
  const [{ rows: entries, total: entryTotal }, report, payouts, summary] = await Promise.all([
    getAgencyCommissionEntries(membership.agency.id, entryFilters, page),
    getAgencyCommissionReport(membership.agency.id, filters),
    getAgencyCommissionPayouts(membership.agency.id),
    getAgencyEarningsSummary(membership.agency.id),
  ]);
  const hrefFor = (target: number) => {
    const params = new URLSearchParams({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(type ? { type } : {}),
      ...(view ? { view } : {}),
      ...(target > 1 ? { page: String(target) } : {}),
    });
    const qs = params.toString();
    return qs ? `/agent/reports?${qs}` : "/agent/reports";
  };
  if (page > 1 && entries.length === 0) redirect(hrefFor(1));
  const months = report.months;

  const query = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ from, to, type, ...extra })) if (value) params.set(key, value);
    return params.toString();
  };
  const withQuery = (qs: string) => (qs ? `/agent/reports?${qs}` : "/agent/reports");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commissions & earnings"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<a href="/agent/reports/export" />}>
              <Download data-icon="inline-start" aria-hidden="true" /> Export CSV
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href={`/agent/reports/statement?${query({})}`} />}>
              <FileText data-icon="inline-start" aria-hidden="true" /> PDF statement
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <FilterChips
          label="Filter by product"
          active={itemType ?? ""}
          items={[
            { key: "", label: "All products", href: withQuery(query({ type: undefined })) },
            ...Object.entries(VERTICAL_LABELS).map(([key, label]) => ({
              key,
              label,
              href: withQuery(query({ type: key })),
            })),
          ]}
        />
        <ReportFilters defaultFrom={from} defaultTo={to} defaultType={type} />
      </div>

      <nav aria-label="Earnings views" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ViewCard href={withQuery(query({ view: view === "total" ? undefined : "total" }))} active={view === "total"} icon={Wallet} tone="var(--chart-1)" label="Total earned" value={<AgentMoney value={usd(report.earnedTotal)} />} sub={`${report.earnedCount} settled ${report.earnedCount === 1 ? "booking" : "bookings"}`} />
        <ViewCard href={withQuery(query({ view: view === "month" ? undefined : "month" }))} active={view === "month"} icon={CalendarDays} tone="var(--chart-3)" label="Earned this month" value={<AgentMoney value={usd(report.earnedThisMonth)} />} sub={format(new Date(), "MMMM yyyy")} />
        <ViewCard href={withQuery(query({ view: view === "review" ? undefined : "review" }))} active={view === "review"} icon={Clock3} tone="var(--chart-5)" label="In review by STS" value={<AgentMoney value={usd(summary.inReview)} />} />
        <ViewCard href={withQuery(query({ view: view === "available" ? undefined : "available" }))} active={view === "available"} icon={CircleCheck} tone="var(--primary)" label="Available to withdraw" value={<AgentMoney value={usd(summary.available)} />} />
      </nav>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">By month</h2>
          <Card className="overflow-hidden py-0">
            {months.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <CalendarDays />
                </EmptyMedia>
                <EmptyTitle>No earnings</EmptyTitle>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead numeric>Bookings</TableHead>
                    <TableHead numeric>Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{format(new Date(`${row.month}-01`), "MMM yyyy")}</TableCell>
                      <TableCell numeric>{row.bookings}</TableCell>
                      <TableCell numeric className="font-medium">
                        {<AgentMoney value={usd(row.total)} />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>

        <section className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <h2 id="entries" className="font-heading text-base font-semibold">{view ? VIEWS[view].title : "All entries"}</h2>
            {entryTotal > 0 ? (
              <Badge variant="neutral" className="tabular-nums">
                {entryTotal}
              </Badge>
            ) : null}
            {view ? <Link href={withQuery(query({ view: undefined }))} className="ml-auto text-xs font-semibold text-primary hover:underline">Show all</Link> : null}
          </div>
          <Card className="overflow-hidden py-0">
            {entries.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Receipt />
                </EmptyMedia>
                <EmptyTitle>No commission entries</EmptyTitle>
              </Empty>
            ) : (
              <Table>
                <TableHeader className="bg-muted/60 [&_th]:text-[0.6875rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
                  <TableRow>
                    <TableHead className="pl-5">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead numeric>Amount</TableHead>
                    <TableHead className="pr-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry: AgencyCommissionEntry) => {
                    const reversed = entry.status === "reversed";
                    const types = [...new Set((entry.order?.order_items ?? []).map((item) => VERTICAL_LABELS[item.item_type]))];
                    const commission = Number(entry.commission_amount);
                    const markup = Number(entry.markup_amount);
                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/40">
                        <TableCell className="whitespace-nowrap pl-5 tabular-nums text-muted-foreground">{format(new Date(entry.created_at), "d MMM yyyy")}</TableCell>
                        <TableCell className="font-medium">{types.join(", ") || "Booking"}</TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-primary">{entry.order?.order_number ?? "—"}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[commission > 0 ? `${entry.rate_applied}% commission ${usd(commission)}` : null, markup > 0 ? `markup ${usd(markup)}` : null].filter(Boolean).join(" · ") || "No earning"}
                          </span>
                        </TableCell>
                        <TableCell numeric className={cn("font-semibold tabular-nums", reversed ? "text-destructive" : "text-foreground")}>
                          {reversed ? "−" : "+"}<AgentMoney value={usd(Number(entry.amount))} />
                        </TableCell>
                        <TableCell className="pr-5">
                          <Badge variant={statusBadgeVariant(entry.status, ENTRY_STATUS_VARIANT)} className="capitalize">
                            {ENTRY_STATUS_LABELS[entry.status] ?? entry.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
          <Pager page={page} total={entryTotal} hrefFor={hrefFor} />
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Payout history</h2>
        <Card className="overflow-hidden py-0">
          {payouts.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Banknote />
              </EmptyMedia>
              <EmptyTitle>No payouts</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paid</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead numeric>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-muted-foreground">{format(new Date(payout.paid_at), "d MMM yyyy")}</TableCell>
                    <TableCell>{payout.method ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{payout.payout_reference ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {payout.period_start && payout.period_end
                        ? `${format(new Date(payout.period_start), "d MMM")} – ${format(new Date(payout.period_end), "d MMM yyyy")}`
                        : "—"}
                    </TableCell>
                    <TableCell numeric className="font-medium">
                      {<AgentMoney value={usd(Number(payout.amount))} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>
    </div>
  );
}

function ViewCard({ href, active, icon: Icon, tone, label, value, sub }: {
  href: string; active: boolean; icon: LucideIcon; tone: string; label: string; value: React.ReactNode; sub?: string;
}) {
  return (
    <Link
      href={`${href}#entries`}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group min-w-0 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring",
        active ? "border-transparent ring-2" : "border-border"
      )}
      style={{ ["--tw-ring-color" as string]: tone, ...(active ? { background: `color-mix(in oklch, ${tone} 8%, var(--card))` } : {}) }}
    >
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex size-7 items-center justify-center rounded-lg text-white" style={{ background: tone }}><Icon className="size-3.5" aria-hidden="true" /></span>
        {label}
      </span>
      <span className="mt-3 block truncate font-heading text-xl font-semibold tracking-tight tabular-nums sm:text-2xl" style={{ color: active ? tone : undefined }}>{value}</span>
      {sub ? <span className="mt-0.5 block truncate text-xs text-muted-foreground tabular-nums">{sub}</span> : null}
    </Link>
  );
}
