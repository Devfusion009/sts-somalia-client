import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  Building2,
  Download,
  Landmark,
  PartyPopper,
  Plane,
  Stamp,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyOrder } from "@/modules/agencies/queries";
import { describeOrderItem, hotelGuestNames } from "@/modules/payments/queries";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CancelOrderButton } from "@/modules/orders/components/cancel-order-button";

const TYPE_ICON = {
  hotel: Building2,
  flight: Plane,
  visa: Stamp,
  umrah: Landmark,
  hall: PartyPopper,
} as const;

const ORDER_STATUS_STYLES: Record<string, string> = {
  held: "bg-brand-gold/15 text-brand-gold",
  pending_payment: "bg-brand-gold/15 text-brand-gold",
  paid: "bg-primary/10 text-primary",
  processing: "bg-chart-3/10 text-chart-3",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/10 text-destructive",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-primary/10 text-primary",
  processing: "bg-chart-3/10 text-chart-3",
  requires_action: "bg-brand-gold/15 text-brand-gold",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
  partially_refunded: "bg-destructive/10 text-destructive",
};

const PAYABLE = ["pending_payment", "held", "partially_paid"];

function money(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(0)}`;
}

export default async function AgentBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { id } = await params;
  const order = await getAgencyOrder(membership.agency.id, id);
  if (!order) notFound();

  const paidTotal = order.payments
    .filter((payment) => payment.status === "succeeded")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const total = Number(order.total);
  const balance = Math.max(total - paidTotal, 0);
  // Manual hotels seeded "price on request" sit at total 0 until STS quotes
  // them from the admin queue — showing a computed balance reads as free.
  const awaitingPrice = total === 0 && PAYABLE.includes(order.status);
  const payable = PAYABLE.includes(order.status) && balance > 0 && !awaitingPrice;
  const cancellable = order.status === "pending_payment" || order.status === "held" || awaitingPrice;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackLink href="/agent/bookings" label="Bookings" className="mb-3" />
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
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Net</dt>
          <dd className="font-medium tabular-nums">{money(Number(order.subtotal), order.currency)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Your margin</dt>
          <dd className="font-medium tabular-nums">
            {money(Number(order.markup_amount ?? 0), order.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Customer pays</dt>
          <dd className="font-semibold tabular-nums">
            {awaitingPrice ? "On request" : money(total, order.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Balance</dt>
          <dd className="font-semibold tabular-nums">
            {awaitingPrice ? "On request" : money(balance, order.currency)}
          </dd>
        </div>
      </dl>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Items</h2>
        <Card className="overflow-hidden py-0">
          <CardContent className="divide-y divide-border px-4 py-0">
            {order.order_items.map((item) => {
              const info = describeOrderItem(item);
              const Icon = TYPE_ICON[item.item_type];
              const guestNames =
                item.item_type === "hotel" ? hotelGuestNames(item.hotel_booking?.guest_details) : [];
              return (
                <div key={item.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{info.title}</p>
                      {item.item_type === "hotel" && item.hotel_booking?.status === "waitlisted" ? (
                        <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">
                          Waitlisted
                        </Badge>
                      ) : item.item_type === "hotel" && item.hotel_booking?.status === "confirmed" ? (
                        <Badge className="border-transparent bg-primary/10 text-primary">
                          Room confirmed
                        </Badge>
                      ) : null}
                    </div>
                    {info.subtitle ? (
                      <p className="text-xs text-muted-foreground">{info.subtitle}</p>
                    ) : null}
                    {guestNames.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Guests: {guestNames.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right text-sm tabular-nums">
                    <p className="font-medium">{money(Number(item.total_price), order.currency)}</p>
                    {item.quantity > 1 ? (
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {money(Number(item.unit_price), order.currency)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Payments</h2>
        {order.payments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No payments recorded yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(payment.created_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.method_label ?? payment.provider}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {payment.provider_ref ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {money(Number(payment.amount), payment.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border-transparent capitalize",
                            PAYMENT_STATUS_STYLES[payment.status] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {payment.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {payable ? (
          <Button className="gap-1.5" render={<Link href={`/agent/book/order/${order.id}`} />}>
            Pay now <ArrowRight className="size-3.5" />
          </Button>
        ) : null}
        {order.status === "paid" || order.status === "completed" ? (
          <Button
            variant="outline"
            className="gap-1.5"
            render={<a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />}
          >
            <Download className="size-3.5" /> Invoice
          </Button>
        ) : null}
        {cancellable ? (
          <CancelOrderButton orderId={order.id} redirectTo="/agent/bookings" />
        ) : null}
      </div>
    </div>
  );
}
