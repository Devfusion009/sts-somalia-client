import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { AlertCircle, ArrowLeft, CheckCircle2, Download } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyOrder, getAgencyTopupRequests } from "@/modules/agencies/queries";
import { describeOrderItem } from "@/modules/orders/format";
import { WalletPaymentPanel } from "@/modules/agencies/components/wallet-payment-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PayFromWalletForm } from "./pay-from-wallet-form";

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

export default async function DeskOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ topup?: string }>;
}) {
  const [{ orderId }, { topup }] = await Promise.all([params, searchParams]);
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const [order, topups] = await Promise.all([
    getAgencyOrder(membership.agency.id, orderId),
    getAgencyTopupRequests(membership.agency.id),
  ]);
  if (!order) notFound();

  const canTopUp = membership.roleInAgency === "owner" || membership.roleInAgency === "admin";
  const pendingTopupTotal = topups
    .filter((request) => request.status === "pending")
    .reduce((sum, request) => sum + Number(request.amount), 0);

  const paid = order.payments
    .filter((payment) => payment.status === "succeeded")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const total = Number(order.total);
  const balance = Math.max(total - paid, 0);
  const available =
    Number(membership.agency.credit_balance ?? 0) + Number(membership.agency.credit_limit ?? 0);
  const payable = PAYABLE.includes(order.status) && balance > 0;
  // A manual hotel seeded at "price on request" reaches here with total 0:
  // nothing is owed yet because STS hasn't quoted the rate (admin queue →
  // updateHotelBookingPrice), and rendering that as a payable USD 0 reads as
  // a free booking.
  const awaitingPrice = total === 0 && PAYABLE.includes(order.status);

  return (
    <div className="space-y-4">
      <Link
        href="/agent/book"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> New booking
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">{order.order_number}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[
              order.agency_customer?.full_name,
              order.agency_customer?.phone,
              format(new Date(order.created_at), "d MMM yyyy"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Badge
          className={cn(
            "border-transparent capitalize",
            ORDER_STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"
          )}
        >
          {awaitingPrice ? "Awaiting price" : order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-secondary/40 px-4 py-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Net</dt>
          <dd className="font-medium tabular-nums">
            {order.currency} {Number(order.subtotal).toFixed(0)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Your margin</dt>
          <dd className="font-medium tabular-nums">
            {order.currency} {Number(order.markup_amount ?? 0).toFixed(0)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Customer pays
          </dt>
          <dd className="font-semibold tabular-nums">
            {awaitingPrice ? "On request" : `${order.currency} ${total.toFixed(0)}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Balance</dt>
          <dd className="font-semibold tabular-nums">
            {awaitingPrice ? "On request" : `${order.currency} ${balance.toFixed(0)}`}
          </dd>
        </div>
      </dl>

      <Card className="py-0">
        <CardContent className="divide-y divide-border px-4 py-0">
          {order.order_items.map((item) => {
            const info = describeOrderItem(item);
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{info.title}</p>
                  {info.subtitle ? (
                    <p className="truncate text-xs text-muted-foreground">{info.subtitle}</p>
                  ) : null}
                </div>
                {item.item_type === "hotel" && item.hotel_booking?.status === "waitlisted" ? (
                  <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">
                    Waitlisted
                  </Badge>
                ) : null}
              </div>
            );
          })}
        </CardContent>
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

      {payable ? (
        <WalletPaymentPanel
          due={balance}
          available={available}
          currency={order.currency}
          canTopUp={canTopUp}
          pendingTopupTotal={pendingTopupTotal}
          returnTo={`/agent/book/order/${order.id}`}
        >
          <PayFromWalletForm
            orderId={order.id}
            amount={balance}
            available={available}
            currency={order.currency}
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
        {order.status === "paid" || order.status === "completed" ? (
          <Button
            variant="outline"
            className="gap-1.5"
            render={
              <a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />
            }
          >
            <Download className="size-3.5" /> Invoice
          </Button>
        ) : null}
      </div>
    </div>
  );
}
