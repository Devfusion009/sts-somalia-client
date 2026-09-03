import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowDownLeft, Banknote, FileSpreadsheet, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { getAgencyLedger, ledgerTotals, type LedgerGroup } from "@/modules/agencies/ledger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

const STATUS_STYLES: Record<string, string> = {
  "In review": "bg-brand-gold/15 text-brand-gold",
  Available: "bg-primary/10 text-primary",
  "Paid out": "bg-chart-3/10 text-chart-3",
  Reversed: "bg-destructive/10 text-destructive",
  Completed: "bg-chart-3/10 text-chart-3",
  Requested: "bg-brand-gold/15 text-brand-gold",
  Approved: "bg-primary/10 text-primary",
};

function money(amount: number) {
  return `USD ${Math.abs(amount).toFixed(2)}`;
}

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Transactions</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            render={<a href={`/agent/finance/transactions/export?format=xlsx&${query}`} />}
          >
            <FileSpreadsheet className="size-3.5" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            render={<a href={`/agent/finance/transactions/export?format=csv&${query}`} />}
          >
            <FileSpreadsheet className="size-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {GROUP_FILTERS.map((filter) => {
          const params = new URLSearchParams({
            ...(filter.key ? { group: filter.key } : {}),
            ...(period.key ? { period: period.key } : {}),
          }).toString();
          const active = (group ?? "") === filter.key;
          return (
            <Link
              key={filter.label}
              href={`/agent/finance/transactions${params ? `?${params}` : ""}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
            </Link>
          );
        })}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {periods.map((p) => {
          const params = new URLSearchParams({
            ...(group ? { group } : {}),
            ...(p.key ? { period: p.key } : {}),
          }).toString();
          const active = period.key === p.key;
          return (
            <Link
              key={p.label}
              href={`/agent/finance/transactions${params ? `?${params}` : ""}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-transparent bg-secondary text-secondary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <Card className="bg-secondary/40">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Money in</p>
            <p className="mt-0.5 font-heading text-lg font-bold text-primary">{money(totals.moneyIn)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Money out</p>
            <p className="mt-0.5 font-heading text-lg font-bold text-destructive">{money(totals.moneyOut)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net</p>
            <p className="mt-0.5 font-heading text-lg font-bold">
              {totals.net < 0 ? "− " : ""}
              {money(totals.net)}
            </p>
          </div>
          {totals.inFlight > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">In flight</p>
              <p className="mt-0.5 font-heading text-lg font-bold text-brand-gold">{money(totals.inFlight)}</p>
            </div>
          ) : null}
          <p className="ml-auto text-xs text-muted-foreground">
            {totals.count} {totals.count === 1 ? "transaction" : "transactions"}
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        {rows.length === 0 ? (
          <CardContent className="py-14 text-center text-sm text-muted-foreground">No transactions.</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const Icon = GROUP_ICONS[row.group];
                  return (
                    <TableRow key={row.id} className={cn(!row.settled && "opacity-70")}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(row.createdAt), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          {row.type}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="truncate text-sm" title={row.detail}>
                          {row.detail}
                        </p>
                        {row.reference ? (
                          <p className="font-mono text-xs text-muted-foreground">{row.reference}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                        {row.customer ?? "—"}
                      </TableCell>
                      <TableCell>
                        {row.status ? (
                          <Badge
                            className={cn(
                              "border-transparent",
                              STATUS_STYLES[row.status] ?? "bg-muted text-muted-foreground"
                            )}
                          >
                            {row.status}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold whitespace-nowrap",
                          row.amount < 0 ? "text-destructive" : row.amount > 0 ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {row.amount === 0 ? "—" : `${row.amount < 0 ? "−" : "+"} ${money(row.amount)}`}
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap text-muted-foreground">
                        {row.balanceAfter === null ? "—" : money(row.balanceAfter)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
