import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyBatchOrders, getAgencyTopupRequests } from "@/modules/agencies/queries";
import { describeOrderItem } from "@/modules/orders/format";
import { WalletPaymentPanel } from "@/modules/agencies/components/wallet-payment-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/money";
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

export const metadata = { title: "Review & pay" };

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

  const customersLabel = orders
    .map((order) => order.agency_customer?.full_name)
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/agent/book", label: "New booking" }}
        title={`${orders.length} booking${orders.length === 1 ? "" : "s"}`}
        meta={customersLabel || undefined}
        actions={
          <>
            <Button variant="outline" render={<Link href="/agent/bookings" />}>
              All bookings
            </Button>
            <Button variant="outline" render={<Link href="/agent/book" />}>
              Book another service
            </Button>
          </>
        }
      />

      {failed ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Could not book for {failed}.</AlertDescription>
        </Alert>
      ) : null}

      {topup === "success" ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Wallet topped up.</AlertDescription>
        </Alert>
      ) : topup === "pending" ? (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>Approve the payment on your phone to finish this top-up.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold">Orders</h2>
            <Badge variant="neutral" className="tabular-nums">
              {orders.length}
            </Badge>
          </div>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>Total</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const orderAwaitingPrice = Number(order.total) === 0 && PAYABLE.includes(order.status);
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <p className="font-medium">{order.agency_customer?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{order.order_number}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.order_items.map((item) => (
                          <p key={item.id} className="max-w-64 truncate">
                            {describeOrderItem(item).title}
                          </p>
                        ))}
                      </TableCell>
                      <TableCell>
                        {orderAwaitingPrice ? (
                          <Badge variant="warning">Awaiting price</Badge>
                        ) : (
                          <Badge variant={statusBadgeVariant(order.status)} className="capitalize">
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell numeric className="text-sm font-medium">
                        {orderAwaitingPrice ? (
                          <span className="font-normal text-muted-foreground">On request</span>
                        ) : (
                          money(Number(order.total), order.currency)
                        )}
                      </TableCell>
                      <TableCell numeric>
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/agent/book/order/${order.id}`} />}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </section>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Net</dt>
                  <dd className="tabular-nums">{money(total - margin, currency)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Your margin</dt>
                  <dd className="tabular-nums">{money(margin, currency)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2 font-medium">
                  <dt>Customers pay</dt>
                  <dd className="font-heading text-base font-semibold tabular-nums">
                    {awaitingPrice ? "On request" : money(total, currency)}
                  </dd>
                </div>
                {paidTotal > 0 ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="tabular-nums">{money(paidTotal, currency)}</dd>
                  </div>
                ) : null}
                {!awaitingPrice ? (
                  <div
                    className={cn(
                      "flex items-baseline justify-between gap-3 font-medium",
                      paidTotal > 0 && "border-t border-border pt-2"
                    )}
                  >
                    <dt>Balance due</dt>
                    <dd
                      className={cn(
                        "font-heading text-base font-semibold tabular-nums",
                        balance > 0 && "text-[color-mix(in_oklch,var(--brand-gold),black_30%)] dark:text-brand-gold"
                      )}
                    >
                      {money(balance, currency)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

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
                amount={balance}
                available={available}
                currency={currency}
              />
            </WalletPaymentPanel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
