import { format, formatDistanceToNowStrict } from "date-fns";
import {
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
  type LucideIcon,
} from "lucide-react";
import { StatTile } from "@/components/dashboard/stat-tile";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { getOrderQueue, getOrdersByIds } from "@/modules/admin/queries";
import { describeOrderItem, travelWindow, travelLength, orderTravelStart } from "@/modules/admin/order-items";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { OrderStatusSelect } from "./order-status-select";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { ConfirmPaymentButton } from "./confirm-payment-button";
import { cn } from "@/lib/utils";
import { money } from "@/lib/money";

export const metadata = { title: "Orders & Payments" };

const ITEM_ICON: Record<string, LucideIcon> = {
  hotel: Building2,
  flight: Plane,
  visa: FileText,
  umrah: Landmark,
  hall: PartyPopper,
};

/** Payment rows: a manual payment waiting on staff is the one to act on. */
const PAYMENT_STATUS_VARIANT = { requires_action: "warning", partially_refunded: "neutral" } as const;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "action", label: "Needs action" },
  { key: "upcoming", label: "Travelling soon" },
  { key: "pending_payment", label: "Unpaid" },
  { key: "partially_paid", label: "Partially paid" },
  { key: "paid", label: "Paid" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; order?: string }>;
}) {
  const { filter: filterParam, page: pageParam, order: orderParam } = await searchParams;
  // Opened from a new-order alert: that order is pinned to the top and outlined.
  const focusId = orderParam && /^[0-9a-f-]{36}$/i.test(orderParam) ? orderParam : null;
  const filter = FILTERS.find((f) => f.key === filterParam)?.key ?? "all";
  const page = parsePage(pageParam);

  // Filters, chip counts and the stat tiles are aggregated in the database;
  // only the page of orders actually shown loads its full booking and payment detail.
  const today = new Date().setHours(0, 0, 0, 0);
  const queue = await getOrderQueue(filter, page, format(today, "yyyy-MM-dd"));
  const [listed, focused] = await Promise.all([
    getOrdersByIds(queue.ids),
    focusId ? getOrdersByIds([focusId]) : Promise.resolve([]),
  ]);
  const visible = [...focused, ...listed.filter((o) => o.id !== focusId)];

  return (
    <div className="space-y-6">
      <PageHeader title="Orders & Payments" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Orders" value={queue.total.toLocaleString("en-US")} />
        <StatTile
          label="Settled revenue"
          value={`USD ${Math.round(queue.settledRevenue).toLocaleString("en-US")}`}
          hint={`${queue.settledCount} paid`}
        />
        <StatTile
          label="Awaiting confirmation"
          value={String(queue.action)}
          hint="bank transfer / cash"
          tone={queue.action > 0 ? "warn" : undefined}
        />
        <StatTile
          label="Travelling within 30 days"
          value={String(queue.upcoming)}
          tone={queue.upcoming > 0 ? "primary" : undefined}
        />
      </div>

      <FilterChips
        label="Filter orders"
        active={filter}
        showZero
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          href: `/admin/orders?filter=${f.key}`,
          count:
            f.key === "all"
              ? queue.total
              : f.key === "action"
                ? queue.action
                : f.key === "upcoming"
                  ? queue.upcoming
                  : (queue.byStatus[f.key] ?? 0),
        }))}
      />

      {visible.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>{queue.total === 0 ? "No orders" : "No orders match this filter"}</EmptyTitle>
            </Empty>
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
            const paidTotal = order.payments
              .filter((p) => p.status === "succeeded")
              .reduce((sum, p) => sum + Number(p.amount), 0);
            const balanceDue = Number(order.total) - paidTotal;

            return (
              <Card
                key={order.id}
                id={`order-${order.id}`}
                className={cn(
                  "scroll-mt-24 overflow-hidden py-0",
                  order.id === focusId && "ring-2 ring-primary",
                  // A payment waiting on a human is the only reason to look at
                  // this page urgently, so it gets a visible edge rather than
                  // being one badge among many.
                  awaiting.length > 0 && "ring-2 ring-brand-gold/50"
                )}
              >
                <CardContent className="p-0">
                  {/* Header: who, how much, what state */}
                  <div className="flex flex-col gap-4 border-b border-border bg-muted/30 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading font-semibold tabular-nums">{order.order_number}</span>
                        <Badge variant={statusBadgeVariant(order.status)} className="capitalize">
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                        {order.agency?.name ? (
                          <Badge variant="info">
                            <Users aria-hidden="true" /> {order.agency.name}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">Direct (B2C)</Badge>
                        )}
                      </div>
                      {/* On an agency order customer_id holds the agent who placed
                          it, so the guest has to come from the agency's own client
                          record or the name here is the wrong person. */}
                      <p className="mt-1.5 text-sm font-medium">
                        {order.agency_customer?.full_name ?? order.customer?.full_name ?? "—"}
                        {order.agency_customer?.full_name && order.customer?.full_name ? (
                          <span className="ml-1 font-normal text-muted-foreground">
                            · booked by {order.customer.full_name}
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {order.customer?.email ? (
                          <a
                            href={`mailto:${order.customer.email}`}
                            className="flex min-w-0 items-center gap-1 break-all hover:text-foreground"
                          >
                            <Mail className="size-3 shrink-0" aria-hidden="true" /> {order.customer.email}
                          </a>
                        ) : null}
                        {order.customer?.phone ? (
                          <a
                            href={`tel:${order.customer.phone.replace(/\s/g, "")}`}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            <Phone className="size-3 shrink-0" aria-hidden="true" /> {order.customer.phone}
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <p className="font-heading text-xl font-semibold tabular-nums">
                        {money(order.total, order.currency)}
                      </p>
                      {order.status === "partially_paid" ? (
                        <p className="text-xs tabular-nums">
                          <span className="text-muted-foreground">
                            {money(paidTotal, order.currency)} paid ·{" "}
                          </span>
                          <span className="font-semibold text-foreground">
                            {money(balanceDue, order.currency)} due
                          </span>
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground tabular-nums">
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
                        <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              {d.title}
                              <Badge variant="neutral">{d.typeLabel}</Badge>
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

                          <div className="ml-13 sm:ml-0 sm:text-right">
                            {window ? (
                              <p className="flex items-center gap-1.5 text-sm font-medium tabular-nums sm:justify-end">
                                <CalendarRange className="size-3.5 text-muted-foreground" aria-hidden="true" />
                                {window}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">No travel dates</p>
                            )}
                            {length ? (
                              <p className="text-xs text-muted-foreground">{length}</p>
                            ) : null}
                          </div>

                          <span className="ml-auto min-w-24 text-right text-sm font-medium tabular-nums">
                            {money(item.total_price, order.currency)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Payments + documents */}
                  <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      {order.payments.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No payments</span>
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
                              variant={statusBadgeVariant(payment.status, PAYMENT_STATUS_VARIANT)}
                              className="capitalize"
                            >
                              {payment.provider === "manual" && payment.status === "requires_action" ? "Pending payment approval" : payment.status.replace(/_/g, " ")}
                            </Badge>
                            <span className="text-muted-foreground tabular-nums">
                              {formatDistanceToNowStrict(new Date(payment.created_at))} ago
                            </span>
                            {payment.provider === "manual" && payment.status === "requires_action" && ["pending_payment", "held", "partially_paid"].includes(order.status) ? (
                              <ConfirmPaymentButton paymentId={payment.id} />
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {balanceDue > 0.01 && !["cancelled", "refunded"].includes(order.status) ? (
                        <RecordPaymentDialog orderId={order.id} remaining={balanceDue} currency={order.currency} />
                      ) : null}
                      {daysToTravel !== null && daysToTravel >= 0 && daysToTravel <= 30 ? (
                        <Badge variant="warning" className="tabular-nums">
                          {daysToTravel === 0 ? "Departs today" : `Departs in ${daysToTravel}d`}
                        </Badge>
                      ) : null}
                      {invoice ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="tabular-nums"
                          render={
                            <a
                              href={`/api/invoices/${order.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          <Download aria-hidden="true" /> {invoice.invoice_number}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No invoice</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Pager page={page} total={queue.matching} hrefFor={(n) => `/admin/orders?filter=${filter}&page=${n}`} />
    </div>
  );
}

