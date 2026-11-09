import { AgentMoney } from "@/components/portal/agent-money";
import type { Metadata } from "next";
import { Fragment } from "react";
import { format } from "date-fns";
import { ArrowDownLeft, Banknote, Download, Receipt, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { getAgencyLedger, ledgerTotals, type LedgerGroup } from "@/modules/agencies/ledger";
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterChips, StatStrip, StatStripItem } from "@/components/dashboard/filter-chips";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import { groupByMonth, MonthRow, SignedMoney } from "../ledger-ui";

export const metadata: Metadata = { title: "Transactions" };

const GROUP_FILTERS = [
  { key: "", label: "All" },
  { key: "earning", label: "Earnings" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "wallet", label: "Wallet" },
] as const;

const GROUP_ICONS: Record<LedgerGroup, typeof Wallet> = {
  earning: ArrowDownLeft,
  withdrawal: Banknote,
  wallet: Wallet,
};

/** Ledger status labels (modules/agencies/ledger.ts) → Badge variant. */
const STATUS_VARIANT: Partial<Record<string, BadgeVariant>> = {
  awaiting_confirmation: "warning",
  approved: "info",
  available: "success",
  paid_out: "neutral",
  reversed: "destructive",
  cancelled: "neutral",
};

function periodFilters(year: number) {
  return [
    { key: "", label: "All time", from: undefined, to: undefined },
    { key: "this-year", label: `${year}`, from: `${year}-01-01`, to: `${year}-12-31` },
    { key: "last-year", label: `${year - 1}`, from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
  ];
}

export default async function AgentTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; period?: string }>;
}) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { group: groupParam, period: periodParam } = await searchParams;
  const group = GROUP_FILTERS.some((f) => f.key && f.key === groupParam) ? (groupParam as LedgerGroup) : undefined;
  const periods = periodFilters(new Date().getFullYear());
  const period = periods.find((p) => p.key && p.key === periodParam) ?? periods[0];

  const rows = await getAgencyLedger(membership.agency.id, { group, from: period.from, to: period.to });
  const totals = ledgerTotals(rows);

  const query = new URLSearchParams({
    ...(group ? { group } : {}),
    ...(period.key ? { period: period.key } : {}),
  }).toString();
  const hrefWith = (nextGroup: string, nextPeriod: string) => {
    const params = new URLSearchParams({
      ...(nextGroup ? { group: nextGroup } : {}),
      ...(nextPeriod ? { period: nextPeriod } : {}),
    }).toString();
    return `/agent/finance/transactions${params ? `?${params}` : ""}`;
  };
  const months = groupByMonth(rows, (row) => row.createdAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        meta={
          <span className="tabular-nums">
            {totals.count} {totals.count === 1 ? "transaction" : "transactions"}
          </span>
        }
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<a href={`/agent/finance/transactions/export?format=xlsx&${query}`} />}>
              <Download data-icon="inline-start" aria-hidden="true" /> Excel
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href={`/agent/finance/transactions/export?format=csv&${query}`} />}>
              <Download data-icon="inline-start" aria-hidden="true" /> CSV
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips
          label="Filter by type"
          active={group ?? ""}
          items={GROUP_FILTERS.map((filter) => ({
            key: filter.key,
            label: filter.label,
            href: hrefWith(filter.key, period.key),
          }))}
        />
        <FilterChips
          label="Filter by period"
          active={period.key}
          items={periods.map((p) => ({ key: p.key, label: p.label, href: hrefWith(group ?? "", p.key) }))}
        />
      </div>

      <StatStrip>
        <StatStripItem label="Money in" value={<SignedMoney amount={totals.moneyIn} />} />
        <StatStripItem label="Money out" value={<SignedMoney amount={-totals.moneyOut} />} />
        <StatStripItem
          label="Net"
          value={<>{totals.net < 0 ? "−" : ""}<AgentMoney value={money(Math.abs(totals.net), "USD")} /></>}
        />
        <StatStripItem
          label="In flight"
          value={<AgentMoney value={money(totals.inFlight, "USD")} />}
          tone={totals.inFlight > 0 ? "warn" : undefined}
        />
      </StatStrip>

      <Card className="overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>No transactions</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead numeric>Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((month) => (
                <Fragment key={month.key}>
                  <MonthRow label={month.label} colSpan={7} />
                  {month.rows.map((row) => {
                    const Icon = GROUP_ICONS[row.group];
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(row.createdAt), "d MMM")}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 font-medium">
                            <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            {row.type}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <p className="truncate" title={row.detail}>
                            {row.detail}
                          </p>
                          {row.reference ? (
                            <p className="font-mono text-xs text-muted-foreground">{row.reference}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-muted-foreground">
                          {row.customer ?? "—"}
                        </TableCell>
                        <TableCell>
                          {row.status ? (
                            <Badge variant={statusBadgeVariant(row.status, STATUS_VARIANT)}>{row.status}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell numeric className={cn(!row.settled && "opacity-70")}>
                          <SignedMoney amount={row.amount} />
                        </TableCell>
                        <TableCell numeric className="text-muted-foreground">
                          {row.balanceAfter === null
                            ? "—"
                            : <>{row.balanceAfter < 0 ? "−" : ""}<AgentMoney value={money(Math.abs(row.balanceAfter), "USD")} /></>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
