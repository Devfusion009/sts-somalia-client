import Link from "next/link";
import { format } from "date-fns";
import { BadgeDollarSign, Banknote, CalendarClock, Download, FileText, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyAgency,
  getAgencyCommissionEntries,
  getAgencyCommissionPayouts,
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

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

export default async function AgentReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string }>;
}) {
  const { from, to, type } = await searchParams;
  const itemType =
    type && type in VERTICAL_LABELS ? (type as OrderItemType) : undefined;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const [entries, payouts, summary] = await Promise.all([
    getAgencyCommissionEntries(membership.agency.id, { from, to, itemType }),
    getAgencyCommissionPayouts(membership.agency.id),
    getAgencyEarningsSummary(membership.agency.id),
  ]);
  const earning = entries.filter((e) => e.status !== "reversed");

  const totalEarned = earning.reduce((sum, e) => sum + Number(e.amount), 0);
  const thisMonth = monthKey(new Date().toISOString());
  const earnedThisMonth = earning
    .filter((e) => monthKey(e.created_at) === thisMonth)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const byMonth = new Map<string, { bookings: number; commission: number; markup: number; total: number }>();
  for (const entry of earning) {
    const key = monthKey(entry.created_at);
    const row = byMonth.get(key) ?? { bookings: 0, commission: 0, markup: 0, total: 0 };
    row.bookings += 1;
    row.commission += Number(entry.commission_amount);
    row.markup += Number(entry.markup_amount);
    row.total += Number(entry.amount);
    byMonth.set(key, row);
  }
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const stats = [
    {
      label: "Total Earned",
      value: money(totalEarned),
      sub: `${earning.length} settled bookings`,
      icon: BadgeDollarSign,
      tint: "bg-primary/10 text-primary",
    },
    {
      label: "Earned This Month",
      value: money(earnedThisMonth),
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
                  {months.map(([key, row]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        {format(new Date(`${key}-01`), "MMM yyyy")}
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
              Earnings appear here automatically when an agency booking is paid.
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
