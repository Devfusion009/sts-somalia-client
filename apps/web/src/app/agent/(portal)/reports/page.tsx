import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Banknote, CalendarDays, Download, FileText, Receipt } from "lucide-react";
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
import { FilterChips, StatStrip, StatStripItem } from "@/components/dashboard/filter-chips";
import { money } from "@/lib/money";
import { parsePage } from "@/lib/pagination";
import { Pager } from "@/components/dashboard/pager";
import { ReportFilters } from "./report-filters";
import type { Database } from "@/lib/types/database.types";

export const metadata: Metadata = { title: "Earnings" };

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

export default async function AgentReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string; page?: string }>;
}) {
  const { from, to, type, page: pageParam } = await searchParams;
  const itemType =
    type && type in VERTICAL_LABELS ? (type as OrderItemType) : undefined;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const page = parsePage(pageParam);
  const filters = { from, to, itemType };
  const [{ rows: entries, total: entryTotal }, report, payouts, summary] = await Promise.all([
    getAgencyCommissionEntries(membership.agency.id, filters, page),
    getAgencyCommissionReport(membership.agency.id, filters),
    getAgencyCommissionPayouts(membership.agency.id),
    getAgencyEarningsSummary(membership.agency.id),
  ]);
  const hrefFor = (target: number) => {
    const params = new URLSearchParams({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(type ? { type } : {}),
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
        title="Earnings"
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

      <StatStrip>
        <StatStripItem
          label="Total earned"
          value={usd(report.earnedTotal)}
          sub={`${report.earnedCount} settled ${report.earnedCount === 1 ? "booking" : "bookings"}`}
        />
        <StatStripItem label="Earned this month" value={usd(report.earnedThisMonth)} sub={format(new Date(), "MMMM yyyy")} />
        <StatStripItem
          label="In review by STS"
          value={usd(summary.inReview)}
          tone={summary.inReview > 0 ? "warn" : undefined}
        />
        <StatStripItem label="Available to withdraw" value={usd(summary.available)} tone="primary" />
      </StatStrip>

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
                        {usd(row.total)}
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
            <h2 className="font-heading text-base font-semibold">All entries</h2>
            {entryTotal > 0 ? (
              <Badge variant="neutral" className="tabular-nums">
                {entryTotal}
              </Badge>
            ) : null}
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
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead numeric>Rate</TableHead>
                    <TableHead numeric>Commission</TableHead>
                    <TableHead numeric>Markup</TableHead>
                    <TableHead numeric>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry: AgencyCommissionEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <p className="font-mono text-xs font-medium">{entry.order?.order_number ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(entry.created_at), "d MMM yyyy")}</p>
                      </TableCell>
                      <TableCell numeric className="text-muted-foreground">
                        {entry.rate_applied}%
                      </TableCell>
                      <TableCell numeric>{usd(Number(entry.commission_amount))}</TableCell>
                      <TableCell numeric>{usd(Number(entry.markup_amount))}</TableCell>
                      <TableCell numeric className="font-medium">
                        {usd(Number(entry.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(entry.status, ENTRY_STATUS_VARIANT)} className="capitalize">
                          {ENTRY_STATUS_LABELS[entry.status] ?? entry.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
                      {usd(Number(payout.amount))}
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
