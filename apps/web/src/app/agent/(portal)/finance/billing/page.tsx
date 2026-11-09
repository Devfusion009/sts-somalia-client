import { AgentMoney } from "@/components/portal/agent-money";
import type { Metadata } from "next";
import { Fragment } from "react";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { BadgeMinus, BadgePlus, Download, FileClock, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyInvoices, getAgencyWalletNotes, getAgencyStatement } from "@/modules/agencies/queries";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { money } from "@/lib/money";
import { parsePage } from "@/lib/pagination";
import { Pager } from "@/components/dashboard/pager";
import { groupByMonth, MonthRow, SignedMoney } from "../ledger-ui";
import { WalletNotesTable } from "./wallet-notes-table";

export const metadata: Metadata = { title: "Billing" };

const TABS = [
  { key: "invoices", label: "Invoices" },
  { key: "credit-notes", label: "Credit notes" },
  { key: "debit-notes", label: "Debit notes" },
  { key: "statement", label: "Statement" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const INVOICE_STATUS_OVERRIDES = { issued: "info", void: "destructive" } as const;

const TX_LABELS: Record<string, string> = {
  deposit: "Deposit",
  booking_payment: "Booking payment",
  refund: "Refund",
  adjustment: "Adjustment",
  credit_note: "Credit note",
  debit_note: "Debit note",
};

export default async function AgentBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { tab: tabParam, page: pageParam } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "invoices";
  const agencyId = membership.agency.id;

  const page = parsePage(pageParam);

  const empty = { rows: [], total: 0 };
  const [invoicePage, notePage, statementPage] = await Promise.all([
    tab === "invoices" ? getAgencyInvoices(agencyId, page) : Promise.resolve(empty),
    tab === "credit-notes" || tab === "debit-notes"
      ? getAgencyWalletNotes(agencyId, tab === "credit-notes" ? "credit_note" : "debit_note", page)
      : Promise.resolve(empty),
    tab === "statement" ? getAgencyStatement(agencyId, page) : Promise.resolve(empty),
  ]);
  const invoices = invoicePage.rows;
  const notes = notePage.rows;
  const transactions = statementPage.rows;
  const total = invoicePage.total + notePage.total + statementPage.total;
  const hrefFor = (target: number) =>
    `/agent/finance/billing?tab=${tab}${target > 1 ? `&page=${target}` : ""}`;
  if (page > 1 && invoices.length + notes.length + transactions.length === 0) redirect(hrefFor(1));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        actions={
          tab === "statement" ? (
            <Button variant="outline" nativeButton={false} render={<a href="/agent/finance/billing/export" />}>
              <Download data-icon="inline-start" aria-hidden="true" /> Export CSV
            </Button>
          ) : null
        }
      />

      <FilterChips
        label="Billing documents"
        active={tab}
        items={TABS.map((t) => ({ key: t.key, label: t.label, href: `/agent/finance/billing?tab=${t.key}` }))}
      />

      {tab === "invoices" ? (
        <Card className="overflow-hidden py-0">
          {invoices.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>No invoices</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead numeric>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Download</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {invoice.order?.order_number ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.issued_at ? format(new Date(invoice.issued_at), "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell numeric className="font-medium">
                      {<AgentMoney value={money(Number(invoice.total), invoice.currency)} />}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(invoice.status, INVOICE_STATUS_OVERRIDES)} className="capitalize">
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Download ${invoice.invoice_number} PDF`}
                        title="Download PDF"
                        nativeButton={false}
                        render={<a href={`/api/invoices/${invoice.order?.id}`} target="_blank" rel="noopener noreferrer" />}
                      >
                        <Download aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      ) : null}

      {tab === "credit-notes" ? (
        <WalletNotesTable notes={notes} emptyIcon={BadgePlus} emptyTitle="No credit notes" />
      ) : null}

      {tab === "debit-notes" ? (
        <WalletNotesTable notes={notes} emptyIcon={BadgeMinus} emptyTitle="No debit notes" />
      ) : null}

      {tab === "statement" ? (
        <Card className="overflow-hidden py-0">
          {transactions.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <FileClock />
              </EmptyMedia>
              <EmptyTitle>No activity</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead numeric>Amount</TableHead>
                  <TableHead numeric>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupByMonth(transactions, (tx) => tx.created_at).map((month) => (
                  <Fragment key={month.key}>
                    <MonthRow label={month.label} colSpan={6} />
                    {month.rows.map((tx) => {
                      const balance = Number(tx.balance_after);
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(tx.created_at), "d MMM, HH:mm")}
                          </TableCell>
                          <TableCell className="font-medium">{TX_LABELS[tx.type] ?? tx.type}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {tx.document_number ?? tx.order?.order_number ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-muted-foreground" title={tx.note ?? ""}>
                            {tx.note ?? "—"}
                          </TableCell>
                          <TableCell numeric>
                            <SignedMoney amount={Number(tx.amount)} />
                          </TableCell>
                          <TableCell numeric className="text-muted-foreground">
                            {balance < 0 ? "−" : ""}
                            {<AgentMoney value={money(Math.abs(balance), "USD")} />}
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
      ) : null}

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
