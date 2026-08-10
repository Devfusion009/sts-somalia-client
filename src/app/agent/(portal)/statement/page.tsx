import type { Metadata } from "next";
import { format } from "date-fns";
import { Download, FileClock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyWallet } from "@/modules/agencies/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Account Statement" };

const TX_LABELS: Record<string, string> = {
  deposit: "Deposit",
  booking_payment: "Booking Payment",
  refund: "Refund",
  adjustment: "Adjustment",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
};

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

export default async function AgentStatementPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const wallet = await getAgencyWallet(membership.agency.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Account Statement</h1>
          <p className="text-sm text-muted-foreground">
            Every deposit, payment, refund, and note against {membership.agency.name}&apos;s wallet, with a running balance.
          </p>
        </div>
        <Button variant="outline" className="gap-1.5" render={<a href="/agent/statement/export" />}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <Card className="overflow-hidden py-0">
        {wallet.transactions.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <FileClock className="size-8 text-muted-foreground" />
            <p className="font-medium">No activity yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Deposits, booking payments, refunds, and notes will appear here as they happen.
            </p>
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
                      className={cn("text-right font-semibold", Number(tx.amount) < 0 ? "text-destructive" : "text-primary")}
                    >
                      {Number(tx.amount) < 0 ? "−" : "+"} {money(Math.abs(Number(tx.amount)))}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{money(Number(tx.balance_after))}</TableCell>
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
