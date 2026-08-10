import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyWallet } from "@/modules/agencies/queries";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
import { Badge } from "@/components/ui/badge";
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

const TX_LABELS: Record<string, string> = {
  deposit: "Deposit",
  booking_payment: "Booking payment",
  refund: "Refund",
  adjustment: "Adjustment",
};

function money(amount: number, signed = false) {
  const formatted = `USD ${Math.abs(amount).toFixed(2)}`;
  if (!signed) return formatted;
  return amount < 0 ? `− ${formatted}` : `+ ${formatted}`;
}

export default async function AgentWalletPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const wallet = await getAgencyWallet(membership.agency.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Agency Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Pay for bookings instantly from your balance — book now, settle with STS on your own
          schedule up to your credit limit.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-start justify-between gap-3 pt-6">
            <div>
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p
                className={cn(
                  "mt-1 font-heading text-2xl font-bold",
                  wallet.balance < 0 ? "text-destructive" : "text-primary"
                )}
              >
                {wallet.balance < 0 ? "−" : ""}USD {Math.abs(wallet.balance).toFixed(2)}
              </p>
              {wallet.balance < 0 ? (
                <p className="mt-0.5 text-xs text-muted-foreground">Owed to STS</p>
              ) : null}
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="size-4.5" />
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3 pt-6">
            <div>
              <p className="text-xs text-muted-foreground">Credit Limit</p>
              <p className="mt-1 font-heading text-2xl font-bold">{money(wallet.creditLimit)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Set by STS</p>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chart-4/10 text-chart-4">
              <PiggyBank className="size-4.5" />
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3 pt-6">
            <div>
              <p className="text-xs text-muted-foreground">Available to Spend</p>
              <p className="mt-1 font-heading text-2xl font-bold text-primary">
                {money(wallet.available)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Balance + credit limit</p>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
              <ArrowUpRight className="size-4.5" />
            </span>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-secondary/60">
        <CardContent className="pt-6 text-sm">
          <p className="font-semibold">Topping up</p>
          <p className="mt-1 text-muted-foreground">
            Transfer funds to STS (bank transfer, EVC Plus, or at any STS office) and the finance
            team credits your wallet — usually within the same business day.{" "}
            <WhatsAppInlineLink
              message={`Hello STS! We'd like to top up the wallet for agency ${membership.agency.name}.`}
            >
              Message us on WhatsApp
            </WhatsAppInlineLink>{" "}
            to confirm a deposit.
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        {wallet.transactions.length === 0 ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No wallet activity yet.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallet.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(tx.created_at), "d MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "gap-1 border-transparent",
                          Number(tx.amount) >= 0
                            ? "bg-primary/10 text-primary"
                            : "bg-brand-gold/15 text-brand-gold"
                        )}
                      >
                        {Number(tx.amount) >= 0 ? (
                          <ArrowDownLeft className="size-3" />
                        ) : (
                          <ArrowUpRight className="size-3" />
                        )}
                        {TX_LABELS[tx.type] ?? tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tx.order?.order_number ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {tx.note ?? "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        Number(tx.amount) < 0 ? "text-destructive" : "text-primary"
                      )}
                    >
                      {money(Number(tx.amount), true)}
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
    </div>
  );
}
