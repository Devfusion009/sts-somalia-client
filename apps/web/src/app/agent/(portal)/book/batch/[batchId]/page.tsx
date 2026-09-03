import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyBatchOrders, getAgencyTopupRequests } from "@/modules/agencies/queries";
import { describeOrderItem } from "@/modules/payments/queries";
import { WalletPaymentPanel } from "@/modules/agencies/components/wallet-payment-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PayBatchForm } from "./pay-batch-form";

const ORDER_STATUS_STYLES: Record<string, string> = {
  held: "bg-brand-gold/15 text-brand-gold",
  pending_payment: "bg-brand-gold/15 text-brand-gold",
  partially_paid: "bg-brand-gold/15 text-brand-gold",
  paid: "bg-primary/10 text-primary",
  processing: "bg-chart-3/10 text-chart-3",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/10 text-destructive",
};

const PAYABLE = ["pending_payment", "held", "partially_paid"];

export default async function BatchBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ failed?: string; topup?: string }>;
}) {
  const [{ batchId }, { failed, topup }] = await Promise.all([params, searchParams]);
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const [orders, topups] = await Promise.all([
    getAgencyBatchOrders(membership.agency.id, batchId),
    getAgencyTopupRequests(membership.agency.id),
  ]);
  if (orders.length === 0) notFound();

  const canTopUp = membership.roleInAgency === "owner" || membership.roleInAgency === "admin";
  const pendingTopupTotal = topups
    .filter((request) => request.status === "pending")
    .reduce((sum, request) => sum + Number(request.amount), 0);

  const currency = orders[0].currency;
  const total = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const paidTotal = orders.reduce(
    (sum, order) =>
      sum +
      order.payments
        .filter((payment) => payment.status === "succeeded")
        .reduce((inner, payment) => inner + Number(payment.amount), 0),
    0
  );
  const margin = orders.reduce((sum, order) => sum + Number(order.markup_amount ?? 0), 0);
  const balance = Math.max(total - paidTotal, 0);
  const payableOrders = orders.filter(
    (order) => PAYABLE.includes(order.status) && Number(order.total) > 0
  );
  // Manual hotels seeded at "price on request" land here with total 0 — STS
  // quotes the rate from the admin queue before anything is owed.
  const awaitingPrice = total === 0 && orders.every((order) => PAYABLE.includes(order.status));
  const available =
    Number(membership.agency.credit_balance ?? 0) + Number(membership.agency.credit_limit ?? 0);

  return (
    <div className="space-y-4">
      <Link
        href="/agent/book"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> New booking
      </Link>

      <h1 className="font-heading text-2xl font-bold">
        {orders.length} booking{orders.length === 1 ? "" : "s"}
      </h1>

      {failed ? (
        <Alert variant="destructive">
          <AlertDescription>Could not book for {failed}.</AlertDescription>
        </Alert>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-secondary/40 px-4 py-3 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Net</dt>
          <dd className="font-medium tabular-nums">
            {currency} {(total - margin).toFixed(0)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Your margin</dt>
          <dd className="font-medium tabular-nums">
            {currency} {margin.toFixed(0)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Customers pay
          </dt>
          <dd className="font-semibold tabular-nums">
            {awaitingPrice ? "On request" : `${currency} ${total.toFixed(0)}`}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Balance</dt>
          <dd className="font-semibold tabular-nums">
            {awaitingPrice ? "On request" : `${currency} ${balance.toFixed(0)}`}
          </dd>
        </div>
      </dl>

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <p className="font-medium">{order.agency_customer?.full_name ?? "—"}</p>
                    <p className="font-mono text-xs text-muted-foreground">{order.order_number}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {order.order_items.map((item) => (
                      <p key={item.id} className="truncate">
                        {describeOrderItem(item).title}
                      </p>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "border-transparent capitalize",
                        ORDER_STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {Number(order.total) === 0 && PAYABLE.includes(order.status)
                        ? "Awaiting price"
                        : order.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    {Number(order.total) === 0 && PAYABLE.includes(order.status)
                      ? "On request"
                      : `${order.currency} ${Number(order.total).toFixed(0)}`}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={`/agent/book/order/${order.id}`} />}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {topup === "success" ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Wallet topped up.</AlertDescription>
        </Alert>
      ) : topup === "pending" ? (
        <Alert>
          <AlertCircle />
          <AlertDescription>Approve the payment on your phone to finish this top-up.</AlertDescription>
        </Alert>
      ) : null}

      {payableOrders.length > 0 ? (
        <WalletPaymentPanel
          due={balance}
          available={available}
          currency={currency}
          canTopUp={canTopUp}
          pendingTopupTotal={pendingTopupTotal}
          returnTo={`/agent/book/batch/${batchId}`}
        >
          <PayBatchForm
            batchId={batchId}
            count={payableOrders.length}
            amountLabel={`${currency} ${balance.toFixed(0)}`}
          />
        </WalletPaymentPanel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" render={<Link href="/agent/book" />}>
          Book another service
        </Button>
        <Button variant="outline" render={<Link href="/agent/bookings" />}>
          All bookings
        </Button>
      </div>
    </div>
  );
}
