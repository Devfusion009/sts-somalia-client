import { AgentMoney } from "@/components/portal/agent-money";
import type { CSSProperties } from "react";
import styles from "./reports.module.css";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import { ArrowUpRight, Check, Banknote, CalendarDays, CircleCheck, Clock3, Download, FileText, Receipt, Wallet, type LucideIcon } from "lucide-react";
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
    <div className={styles.reportPage}>
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

      <section className={styles.filters} aria-label="Report filters">
        <div className={styles.productFilters}>
          <span className={styles.filterLabel}>Service</span>
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
        </div>
        <ReportFilters key={`${from ?? ""}:${to ?? ""}`} defaultFrom={from} defaultTo={to} defaultType={type} />
      </section>

      <nav aria-label="Earnings views" className={styles.summaryGrid}>
        <ViewCard href={withQuery(query({ view: view === "total" ? undefined : "total" }))} active={view === "total"} icon={Wallet} tone="var(--chart-1)" label="Total earned" value={<AgentMoney value={usd(report.earnedTotal)} />} sub={`${report.earnedCount} settled ${report.earnedCount === 1 ? "booking" : "bookings"}`} />
        <ViewCard href={withQuery(query({ view: view === "month" ? undefined : "month" }))} active={view === "month"} icon={CalendarDays} tone="var(--chart-3)" label="Earned this month" value={<AgentMoney value={usd(report.earnedThisMonth)} />} sub={format(new Date(), "MMMM yyyy")} />
        <ViewCard href={withQuery(query({ view: view === "review" ? undefined : "review" }))} active={view === "review"} icon={Clock3} tone="var(--chart-5)" label="In review by STS" value={<AgentMoney value={usd(summary.inReview)} />} sub="All products · All dates" />
        <ViewCard href={withQuery(query({ view: view === "available" ? undefined : "available" }))} active={view === "available"} icon={CircleCheck} tone="var(--primary)" label="Available to withdraw" value={<AgentMoney value={usd(summary.available)} />} sub="All products · All dates" />
      </nav>

      <div className={styles.contentGrid}>
        <section className={styles.ledgerPanel} aria-labelledby="entries">
          <div className={styles.panelHeading}>
            <h2 id="entries" className="font-heading text-base font-semibold">{view ? VIEWS[view].title : "All entries"}</h2>
            {entryTotal > 0 ? (
              <Badge variant="neutral" className="tabular-nums">
                {entryTotal}
              </Badge>
            ) : null}
            {view ? <Link href={withQuery(query({ view: undefined }))} className="ml-auto text-xs font-semibold text-primary hover:underline">Show all</Link> : null}
          </div>
          <div className={styles.ledgerBody}>
            {entries.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Receipt />
                </EmptyMedia>
                <EmptyTitle>No commission entries</EmptyTitle>
              </Empty>
            ) : (
              <Table className={styles.ledgerTable} containerClassName={styles.ledgerScroll}>
                <TableHeader sticky className="bg-muted [&_th]:text-[0.6875rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
                  <TableRow>
                    <TableHead className="pl-5">Date</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Booking</TableHead>
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
                      <TableRow key={entry.id} className={styles.entryRow} data-reversed={reversed || undefined}>
                        <TableCell className="whitespace-nowrap pl-5 tabular-nums text-muted-foreground">{format(new Date(entry.created_at), "d MMM yyyy")}</TableCell>
                        <TableCell><span className={styles.serviceTag}>{types.join(", ") || "Booking"}</span></TableCell>
                        <TableCell>
                          {entry.order_id ? <Link href={`/agent/bookings/${entry.order_id}`} className={styles.orderLink}>{entry.order?.order_number ?? "View booking"}<ArrowUpRight aria-hidden="true" /></Link> : <span className="text-muted-foreground">—</span>}
                          <span className={styles.entryDetails}>
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
          </div>
          <div className={styles.pagination}><Pager page={page} total={entryTotal} hrefFor={hrefFor} /></div>
        </section>
        <section className={styles.monthlyPanel} aria-labelledby="monthly-title">
          <div className={styles.panelHeading}><h2 id="monthly-title">Monthly summary</h2></div>
          {months.length === 0 ? <Empty><EmptyMedia variant="icon"><CalendarDays /></EmptyMedia><EmptyTitle>No earnings</EmptyTitle></Empty> : (
            <dl className={styles.monthlyList}>
              {months.map((row) => <div key={row.month}>
                <dt>{format(new Date(`${row.month}-01`), "MMM yyyy")}<span>{row.bookings} {row.bookings === 1 ? "booking" : "bookings"}</span></dt>
                <dd><AgentMoney value={usd(row.total)} /></dd>
              </div>)}
            </dl>
          )}
        </section>

      </div>

      <section className={styles.payoutPanel} aria-labelledby="payout-history-title">
        <div className={styles.panelHeading}><h2 id="payout-history-title">Payout history</h2><Badge variant="neutral">{payouts.length}</Badge></div>
        <div className={styles.ledgerBody}>
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
        </div>
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
      className={styles.summaryCard}
      style={{ "--metric-color": tone } as CSSProperties}
    >
      <span className={styles.metricHeader}><Icon aria-hidden="true" /><span>{label}</span>{active ? <Check aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}</span>
      <span className={styles.metricValue}>{value}</span>
      {sub ? <span className={styles.metricMeta}>{sub}</span> : null}

    </Link>
  );
}
