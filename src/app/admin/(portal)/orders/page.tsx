import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  BadgeCheck,
  Building2,
  CalendarRange,
  Download,
  FileText,
  Landmark,
  Mail,
  PartyPopper,
  Phone,
  Plane,
  Receipt,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAllOrders } from "@/modules/admin/queries";
import { describeOrderItem, travelWindow, travelLength, orderTravelStart } from "@/modules/admin/order-items";
import { adminConfirmPayment } from "@/modules/payments/actions";
import { OrderStatusSelect } from "./order-status-select";
import { cn } from "@/lib/utils";

export const metadata = { title: "Orders & Payments" };

const ITEM_ICON: Record<string, LucideIcon> = {
  hotel: Building2,
  flight: Plane,
  visa: FileText,
  umrah: Landmark,
  hall: PartyPopper,
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-primary/10 text-primary",
  requires_action: "bg-brand-gold/15 text-brand-gold",
  processing: "bg-chart-3/10 text-chart-3",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
  partially_refunded: "bg-muted text-muted-foreground",
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  paid: "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  processing: "bg-chart-3/10 text-chart-3",
  pending_payment: "bg-brand-gold/15 text-brand-gold",
  held: "bg-brand-gold/15 text-brand-gold",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "action", label: "Needs action" },
  { key: "upcoming", label: "Travelling soon" },
  { key: "pending_payment", label: "Unpaid" },
  { key: "paid", label: "Paid" },
  { key: "cancelled", label: "Cancelled" },
] as const;

function money(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: filterParam } = await searchParams;
  const filter = FILTERS.find((f) => f.key === filterParam)?.key ?? "all";
  const orders = await getAllOrders();

  const today = new Date().setHours(0, 0, 0, 0);
  const needsAction = (o: (typeof orders)[number]) =>
    o.payments.some((p) => p.status === "requires_action");
  const departsWithin30Days = (o: (typeof orders)[number]) => {
    const start = orderTravelStart(o);
    if (!start) return false;
    const days = (new Date(start).setHours(0, 0, 0, 0) - today) / 86_400_000;
    return days >= 0 && days <= 30;
  };

  const visible = orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "action") return needsAction(o);
    if (filter === "upcoming") return departsWithin30Days(o) && o.status !== "cancelled";
    return o.status === filter;
  });

  const settled = orders.filter((o) => ["paid", "processing", "completed"].includes(o.status));
  const revenue = settled.reduce((sum, o) => sum + Number(o.total), 0);
  const actionCount = orders.filter(needsAction).length;
  const soonCount = orders.filter((o) => departsWithin30Days(o) && o.status !== "cancelled").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Orders &amp; Payments</h1>
        <p className="text-sm text-muted-foreground">
          Every order across the platform, what was booked, and when the customer travels.
        </p>
      </div>

      {/* The three numbers an operator opens this page to check. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Receipt} label="Orders" value={String(orders.length)} />
        <StatTile
          icon={Wallet}
          label="Settled revenue"
          value={`USD ${revenue.toFixed(0)}`}
          hint={`${settled.length} paid`}
        />
        <StatTile
          icon={BadgeCheck}
          label="Awaiting confirmation"
          value={String(actionCount)}
          hint="bank transfer / cash"
          tone={actionCount > 0 ? "warn" : undefined}
        />
        <StatTile
          icon={CalendarRange}
          label="Travelling within 30 days"
          value={String(soonCount)}
          tone={soonCount > 0 ? "accent" : undefined}
        />
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filter orders">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const count =
            f.key === "all"
              ? orders.length
              : f.key === "action"
                ? actionCount
                : f.key === "upcoming"
                  ? soonCount
                  : orders.filter((o) => o.status === f.key).length;
          return (
            <Link
              key={f.key}
              href={`/orders?filter=${f.key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-primary-foreground/20" : "bg-secondary"
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="font-medium">No orders here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {orders.length === 0 ? "No orders have been placed yet." : "Try another filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((order) => {
            // invoices has a unique constraint on order_id, so PostgREST
            // embeds it as an object rather than an array.
            const invoice = order.invoices;
            const start = orderTravelStart(order);
            const daysToTravel =
              start && order.status !== "cancelled"
                ? Math.round((new Date(start).setHours(0, 0, 0, 0) - today) / 86_400_000)
                : null;
            const awaiting = order.payments.filter((p) => p.status === "requires_action");

            return (
              <Card
                key={order.id}
                className={cn(
                  "overflow-hidden py-0",
                  // A payment waiting on a human is the only reason to look at
                  // this page urgently, so it gets a visible edge rather than
                  // being one badge among many.
                  awaiting.length > 0 && "ring-2 ring-brand-gold/50"
                )}
              >
                <CardContent className="p-0">
                  {/* Header: who, how much, what state */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-muted/30 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading font-bold">{order.order_number}</span>
                        <Badge
                          className={cn(
                            "border-transparent capitalize",
                            ORDER_STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                        {order.agency?.name ? (
                          <Badge variant="outline" className="gap-1">
                            <Users className="size-3" /> {order.agency.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Direct (B2C)</Badge>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-medium">
                        {order.customer?.full_name ?? "—"}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {order.customer?.email ? (
                          <a
                            href={`mailto:${order.customer.email}`}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            <Mail className="size-3" /> {order.customer.email}
                          </a>
                        ) : null}
                        {order.customer?.phone ? (
                          <a
                            href={`tel:${order.customer.phone.replace(/\s/g, "")}`}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            <Phone className="size-3" /> {order.customer.phone}
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <p className="font-heading text-xl font-bold">
                        {money(order.total, order.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Placed {format(new Date(order.created_at), "d MMM yyyy")}
                        {order.paid_at
                          ? ` · paid ${format(new Date(order.paid_at), "d MMM")}`
                          : ""}
                      </p>
                      <OrderStatusSelect orderId={order.id} status={order.status} />
                    </div>
                  </div>

                  {/* What was booked, and when they travel — the part this page
                      previously did not load at all. */}
                  <ul className="divide-y divide-border">
                    {order.order_items.map((item) => {
                      const d = describeOrderItem(item);
                      const Icon = ITEM_ICON[d.type] ?? FileText;
                      const window = travelWindow(d.from, d.to);
                      const length = travelLength(d.from, d.to);

                      return (
                        <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              {d.title}
                              <Badge variant="secondary" className="text-[10px]">
                                {d.typeLabel}
                              </Badge>
                              {d.status ? (
                                <span className="text-xs text-muted-foreground capitalize">
                                  {d.status.replace(/_/g, " ")}
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                              {d.detail ? <span className="capitalize">{d.detail}</span> : null}
                              {d.pax ? <span>{d.pax}</span> : null}
                              {item.quantity > 1 ? <span>Qty {item.quantity}</span> : null}
                            </p>
                          </div>

                          <div className="text-right">
                            {window ? (
                              <p className="flex items-center justify-end gap-1.5 text-sm font-medium">
                                <CalendarRange className="size-3.5 text-muted-foreground" />
                                {window}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">No travel dates yet</p>
                            )}
                            {length ? (
                              <p className="text-xs text-muted-foreground">{length}</p>
                            ) : null}
                          </div>

                          <span className="w-24 text-right text-sm tabular-nums">
                            {money(item.total_price, order.currency)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Payments + documents */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-3">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      {order.payments.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No payment recorded yet.</span>
                      ) : (
                        order.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                          >
                            <span className="font-medium">
                              {payment.method_label ?? payment.provider}
                            </span>
                            <span className="text-muted-foreground">
                              via {payment.provider}
                              {payment.payer_phone ? ` · ${payment.payer_phone}` : ""}
                            </span>
                            <span className="tabular-nums">
                              {money(payment.amount, payment.currency)}
                            </span>
                            <Badge
                              className={cn(
                                "border-transparent capitalize",
                                PAYMENT_STATUS_STYLES[payment.status] ??
                                  "bg-muted text-muted-foreground"
                              )}
                            >
                              {payment.status.replace(/_/g, " ")}
                            </Badge>
                            <span className="text-muted-foreground">
                              {formatDistanceToNowStrict(new Date(payment.created_at))} ago
                            </span>
                            {payment.status === "requires_action" ? (
                              <form action={adminConfirmPayment}>
                                <input type="hidden" name="paymentId" value={payment.id} />
                                <Button size="sm" type="submit" className="h-7 gap-1">
                                  <BadgeCheck className="size-3.5" />
                                  Confirm funds received
                                </Button>
                              </form>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {daysToTravel !== null && daysToTravel >= 0 && daysToTravel <= 30 ? (
                        <Badge className="border-transparent bg-brand-accent text-brand-accent-foreground">
                          {daysToTravel === 0 ? "Departs today" : `Departs in ${daysToTravel}d`}
                        </Badge>
                      ) : null}
                      {invoice ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          render={
                            <a
                              href={`/api/invoices/${order.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          <Download className="size-3.5" /> {invoice.invoice_number}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No invoice yet</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "warn" | "accent";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            tone === "warn"
              ? "bg-brand-gold/15 text-brand-gold"
              : tone === "accent"
                ? "bg-brand-accent/15 text-brand-accent"
                : "bg-secondary text-primary"
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-xl font-bold tabular-nums">{value}</p>
          <p className="truncate text-xs text-muted-foreground">
            {label}
            {hint ? ` · ${hint}` : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
