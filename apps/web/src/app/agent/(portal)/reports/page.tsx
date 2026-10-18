import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { BadgeDollarSign, Banknote, CalendarClock, Download, FileText, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyAgency,
  getAgencyCommissionEntries,
  getAgencyCommissionPayouts,
  getAgencyCommissionReport,
  getAgencyEarningsSummary,
  type AgencyCommissionEntry,
} from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ADMIN_PAGE_SIZE, parsePage } from "@/lib/pagination";
import { Pager } from "@/components/dashboard/pager";
import { ReportFilters } from "./report-filters";
import type { Database } from "@/lib/types/database.types";

type OrderItemType = Database["public"]["Enums"]["order_item_type"];

const VERTICAL_LABELS: Record<OrderItemType, string> = {
  hotel: "Hotels",
  flight: "Flights",
  visa: "Visa",
  umrah: "Umrah",
  hall: "Events & Halls",
};

const ENTRY_STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  confirmed: "bg-primary/10 text-primary",
  paid_out: "bg-chart-3/10 text-chart-3",
  reversed: "bg-destructive/10 text-destructive",
};

// The same four words the Finance Overview pipeline uses — an agent should
// never have to map "confirmed" here onto "available to withdraw" there.
const ENTRY_STATUS_LABELS: Record<string, string> = {
  pending: "In review",
  confirmed: "Available",
  paid_out: "Paid out",
  reversed: "Reversed",
};

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

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

  const stats = [
    {
      label: "Total Earned",
      value: money(report.earnedTotal),
      sub: `${report.earnedCount} settled bookings`,
      icon: BadgeDollarSign,
      tint: "bg-primary/10 text-primary",
    },
    {
      label: "Earned This Month",
      value: money(report.earnedThisMonth),
      sub: format(new Date(), "MMMM yyyy"),
      icon: TrendingUp,
      tint: "bg-chart-3/10 text-chart-3",
    },
    {
      label: "In review by STS",
      value: money(summary.inReview),
      sub: undefined,
      icon: CalendarClock,
      tint: "bg-brand-gold/15 text-brand-gold",
    },
    {
      label: "Available to withdraw",
      value: money(summary.available),
      sub: undefined,
      icon: Banknote,
      tint: "bg-chart-3/10 text-chart-3",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Earnings &amp; Reports</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" render={<Link href="/agent/reports/export" />}>
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            render={
              <Link
                href={`/agent/reports/statement?${new URLSearchParams({
                  ...(from ? { from } : {}),
                  ...(to ? { to } : {}),
                  ...(type ? { type } : {}),
                }).toString()}`}
              />
            }
          >
            <FileText className="size-3.5" /> PDF Statement
          </Button>
        </div>
      </div>

      <ReportFilters defaultFrom={from} defaultTo={to} defaultType={type} verticals={VERTICAL_LABELS} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-1 truncate font-heading text-2xl font-bold">{stat.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</p>
              </div>
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  stat.tint
                )}
              >
                <stat.icon className="size-4.5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">By Month</CardTitle>
          </CardHeader>
          <CardContent>
            {months.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No earnings yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">
                        {format(new Date(`${row.month}-01`), "MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">{row.bookings}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {money(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b border-border !py-4">
            <CardTitle className="text-base">All Entries</CardTitle>
          </CardHeader>
          {entries.length === 0 ? (
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No commission entries yet.
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Markup</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry: AgencyCommissionEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <p className="font-mono text-xs font-medium">
                          {entry.order?.order_number ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), "d MMM yyyy")}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-sm">{entry.rate_applied}%</TableCell>
                      <TableCell className="text-right text-sm">
                        {money(Number(entry.commission_amount))}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {money(Number(entry.markup_amount))}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {money(Number(entry.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border-transparent capitalize",
                            ENTRY_STATUS_STYLES[entry.status] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {ENTRY_STATUS_LABELS[entry.status] ?? entry.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {entryTotal > ADMIN_PAGE_SIZE ? (
            <div className="border-t border-border px-4 py-3">
              <Pager page={page} total={entryTotal} hrefFor={hrefFor} />
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Payout History</CardTitle>
        </CardHeader>
        {payouts.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No payouts yet.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date Paid</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(payout.paid_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">{payout.method ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{payout.payout_reference ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payout.period_start && payout.period_end
                        ? `${format(new Date(payout.period_start), "d MMM")} – ${format(new Date(payout.period_end), "d MMM yyyy")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{money(Number(payout.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
