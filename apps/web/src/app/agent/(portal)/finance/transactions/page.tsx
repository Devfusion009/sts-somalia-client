import { AgentMoney } from "@/components/portal/agent-money";
import type { Metadata } from "next";
import { Fragment } from "react";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Banknote, Clock3, Download, FileSpreadsheet, Receipt, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { getAgencyLedger, ledgerTotals, type AgencyLedgerEntry, type LedgerGroup } from "@/modules/agencies/ledger";
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { money } from "@/lib/money";
import { groupByMonth, SignedMoney } from "../ledger-ui";

import styles from "./transactions.module.css";

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
    <div className={styles.transactionsPage}>
      <PageHeader title="Transactions" actions={<>
        <Button variant="outline" nativeButton={false} render={<a href={`/agent/finance/transactions/export?format=xlsx&${query}`} />}>
          <FileSpreadsheet data-icon="inline-start" aria-hidden="true" />Excel
        </Button>
        <Button variant="outline" nativeButton={false} render={<a href={`/agent/finance/transactions/export?format=csv&${query}`} />}>
          <Download data-icon="inline-start" aria-hidden="true" />CSV
        </Button>
      </>} />

      <section className={styles.filters} aria-label="Transaction filters">
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Transaction type</span>
          <FilterChips label="Filter by type" active={group ?? ""} items={GROUP_FILTERS.map((filter) => ({ key: filter.key, label: filter.label, href: hrefWith(filter.key, period.key) }))} />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Period</span>
          <FilterChips label="Filter by period" active={period.key} items={periods.map((p) => ({ key: p.key, label: p.label, href: hrefWith(group ?? "", p.key) }))} />
        </div>
      </section>

      <dl className={styles.summary}>
        <div data-tone="incoming"><dt><ArrowDownLeft aria-hidden="true" />Money in</dt><dd><SignedMoney amount={totals.moneyIn} /></dd></div>
        <div data-tone="outgoing"><dt><ArrowUpRight aria-hidden="true" />Money out</dt><dd><SignedMoney amount={-totals.moneyOut} /></dd></div>
        <div data-tone="net"><dt><Wallet aria-hidden="true" />Net movement</dt><dd>{totals.net < 0 ? "−" : ""}<AgentMoney value={money(Math.abs(totals.net), "USD")} /></dd></div>
        <div data-tone="pending"><dt><Clock3 aria-hidden="true" />In flight</dt><dd><AgentMoney value={money(totals.inFlight, "USD")} /></dd></div>
      </dl>

      <section className={styles.history} aria-labelledby="transaction-history-title">
        <div className={styles.historyHeading}>
          <div><h2 id="transaction-history-title">Transaction history</h2><Badge variant="neutral">{totals.count}</Badge></div>
          <span className={styles.historyScope}>{GROUP_FILTERS.find((filter) => filter.key === (group ?? ""))?.label} · {period.label}</span>
        </div>
        {rows.length === 0 ? <Empty><EmptyMedia variant="icon"><Receipt /></EmptyMedia><EmptyTitle>No transactions</EmptyTitle></Empty> : <>
          <div className={styles.desktopScroll} role="region" aria-label="Scrollable transaction history" tabIndex={0}>
            <Table containerClassName="overflow-visible" className={styles.ledgerTable}>
              <TableHeader sticky className={styles.tableHeading}>
                <TableRow><TableHead>Date</TableHead><TableHead>Transaction</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead numeric>Amount</TableHead><TableHead numeric>Wallet balance</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {months.map((month) => <Fragment key={month.key}>
                  <TableRow className={styles.monthRow}><TableCell colSpan={6}><div className={styles.monthHeading}><span role="heading" aria-level={3}>{month.label}</span><span>{month.rows.length} {month.rows.length === 1 ? "entry" : "entries"}</span></div></TableCell></TableRow>
                  {month.rows.map((row) => <TableRow key={row.id} className={styles.entryRow}>
                    <TableCell className={styles.dateCell}><time dateTime={row.createdAt}>{format(new Date(row.createdAt), "d MMM")}</time></TableCell>
                    <TableCell><TransactionIdentity row={row} /></TableCell>
                    <TableCell className={styles.customerCell}>{row.customer ?? <span className={styles.missing}>—</span>}</TableCell>
                    <TableCell><TransactionStatus row={row} /></TableCell>
                    <TableCell numeric className={styles.amountCell}><SignedMoney amount={row.amount} /></TableCell>
                    <TableCell numeric className={styles.balanceCell}><Balance value={row.balanceAfter} /></TableCell>
                  </TableRow>)}
                </Fragment>)}
              </TableBody>
            </Table>
          </div>
          <div className={styles.mobileHistory}>
            {months.map((month) => <section key={month.key} aria-label={month.label}>
              <div className={styles.monthHeading}><h3>{month.label}</h3><span>{month.rows.length} {month.rows.length === 1 ? "entry" : "entries"}</span></div>
              <ul>{month.rows.map((row) => <li key={row.id} className={styles.mobileEntry}>
                <div className={styles.mobileEntryTop}><time dateTime={row.createdAt}>{format(new Date(row.createdAt), "d MMM yyyy")}</time><TransactionStatus row={row} /></div>
                <TransactionIdentity row={row} />
                {row.customer ? <dl className={styles.mobileCustomer}><dt>Customer</dt><dd>{row.customer}</dd></dl> : null}
                <dl className={styles.mobileAmounts}><div><dt>Amount</dt><dd><SignedMoney amount={row.amount} /></dd></div><div><dt>Wallet balance</dt><dd><Balance value={row.balanceAfter} /></dd></div></dl>
              </li>)}</ul>
            </section>)}
          </div>
        </>}
      </section>
    </div>
  );
}

function TransactionIdentity({ row }: { row: AgencyLedgerEntry }) {
  const Icon = GROUP_ICONS[row.group];
  const showDetail = row.detail && row.detail !== row.reference && row.detail !== `Order ${row.reference}`;
  return (
    <div className={styles.transactionIdentity} data-group={row.group}>
      <span className={styles.transactionIcon}><Icon aria-hidden="true" /></span>
      <div className={styles.transactionDescription}>
        <span className={styles.transactionType}>{row.type}</span>
        {showDetail ? <span className={styles.transactionDetail}>{row.detail}</span> : null}
        {row.reference ? <span className={styles.reference}>{row.reference}</span> : null}
      </div>
    </div>
  );
}

function TransactionStatus({ row }: { row: AgencyLedgerEntry }) {
  return row.status ? <Badge variant={statusBadgeVariant(row.status, STATUS_VARIANT)}>{row.status}</Badge> : <span className={styles.missing}>—</span>;
}

function Balance({ value }: { value: number | null }) {
  return value === null ? <span className={styles.missing}>—</span> : <>{value < 0 ? "−" : ""}<AgentMoney value={money(Math.abs(value), "USD")} /></>;
}
