import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { BadgeMinus, BadgePlus, Download, FileClock, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyInvoices, getAgencyWalletNotes, getAgencyWallet } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { WalletNotesTable } from "./wallet-notes-table";

export const metadata: Metadata = { title: "Billing" };

const TABS = [
  { key: "invoices", label: "Invoices" },
  { key: "credit-notes", label: "Credit notes" },
  { key: "debit-notes", label: "Debit notes" },
  { key: "statement", label: "Statement" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const INVOICE_STATUS_STYLES: Record<string, string> = {
  issued: "bg-primary/10 text-primary",
  paid: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  void: "bg-destructive/10 text-destructive",
};

const TX_LABELS: Record<string, string> = {
  deposit: "Deposit",
  booking_payment: "Booking payment",
  refund: "Refund",
  adjustment: "Adjustment",
  credit_note: "Credit note",
  debit_note: "Debit note",
};

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

export default async function AgentBillingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { tab: tabParam } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "invoices";
  const agencyId = membership.agency.id;

  const [invoices, notes, wallet] = await Promise.all([
    tab === "invoices" ? getAgencyInvoices(agencyId) : Promise.resolve([]),
    tab === "credit-notes" || tab === "debit-notes"
      ? getAgencyWalletNotes(agencyId, tab === "credit-notes" ? "credit_note" : "debit_note")
      : Promise.resolve([]),
    tab === "statement" ? getAgencyWallet(agencyId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Billing</h1>
        {tab === "statement" ? (
          <Button variant="outline" size="sm" className="gap-1.5" render={<a href="/agent/finance/billing/export" />}>
            <Download className="size-3.5" /> Export CSV
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/agent/finance/billing?tab=${t.key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              t.key === tab
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "invoices" ? (
        <Card className="overflow-hidden py-0">
          {invoices.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="font-medium">No invoices yet</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {invoice.order?.order_number ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {invoice.issued_at ? format(new Date(invoice.issued_at), "d MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {invoice.currency} {Number(invoice.total).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border-transparent capitalize", INVOICE_STATUS_STYLES[invoice.status] ?? "")}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          render={
                            <a href={`/api/invoices/${invoice.order?.id}`} target="_blank" rel="noopener noreferrer" />
                          }
                        >
                          <Download className="size-3.5" /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "credit-notes" ? (
        <WalletNotesTable notes={notes} emptyIcon={BadgePlus} emptyTitle="No credit notes yet" />
      ) : null}

      {tab === "debit-notes" ? (
        <WalletNotesTable notes={notes} emptyIcon={BadgeMinus} emptyTitle="No debit notes yet" />
      ) : null}

      {tab === "statement" && wallet ? (
        <Card className="overflow-hidden py-0">
          {wallet.transactions.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <FileClock className="size-8 text-muted-foreground" />
              <p className="font-medium">No activity yet</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallet.transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(tx.created_at), "d MMM yyyy, HH:mm")}
                      </TableCell>
                      <TableCell>{TX_LABELS[tx.type] ?? tx.type}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tx.document_number ?? tx.order?.order_number ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground" title={tx.note ?? ""}>
                        {tx.note ?? "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold",
                          Number(tx.amount) < 0 ? "text-destructive" : "text-primary"
                        )}
                      >
                        {Number(tx.amount) < 0 ? "−" : "+"} {money(Math.abs(Number(tx.amount)))}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {money(Number(tx.balance_after))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
