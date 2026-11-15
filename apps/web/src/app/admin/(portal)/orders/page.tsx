import { HotelBookingDetails } from "./hotel-order-details";
import { getPaymentProofs } from "@/modules/payments/proof-actions";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { OrderPaymentsPanel } from "./order-payments-panel";
import { RefreshOrdersButton } from "./refresh-orders-button";
import { OrderReadScope } from "./order-read-scope";
import { visaReviewHandoff } from "@/modules/visa/review-handoff";
import { format } from "date-fns";
import {
  Building2,
  Download,
  FileText,
  Landmark,
  Mail,
  PartyPopper,
  Phone,
  UserRound,
  CalendarDays,
  Plane,
  Receipt,
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
import { describeOrderItem, travelWindow } from "@/modules/admin/order-items";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { OrderStatusSelect } from "./order-status-select";
import { RecordPaymentDialog } from "./record-payment-dialog";
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

const FILTERS = [
  { key: "all", label: "All" },
  { key: "action", label: "Payment requests" },
  { key: "upcoming", label: "Travelling soon" },
  { key: "pending_payment", label: "Unpaid" },
  { key: "partially_paid", label: "Partially paid" },
  { key: "paid", label: "Paid" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; order?: string; q?: string; sort?: string; category?: string }>;
}) {
  const { filter: filterParam, page: pageParam, order: orderParam, q: queryParam, sort: sortParam, category: categoryParam } = await searchParams;
  // Opened from a new-order alert: that order is pinned to the top and outlined.
  const focusId = orderParam && /^[0-9a-f-]{36}$/i.test(orderParam) ? orderParam : null;
  const filter = FILTERS.find((f) => f.key === filterParam)?.key ?? "all";
  const category = ["visa", "hotel", "flight", "hall", "umrah"].includes(categoryParam ?? "") ? categoryParam! : "all";
  const sort = sortParam === "oldest" ? "oldest" : "newest";
  const page = parsePage(pageParam);

  // Filters, chip counts and the stat tiles are aggregated in the database;
  // only the page of orders actually shown loads its full booking and payment detail.
  const today = new Date().setHours(0, 0, 0, 0);
  const search = (queryParam ?? "").trim().slice(0, 100);
  const queue = await getOrderQueue(filter, page, format(today, "yyyy-MM-dd"), { sort, search, category });
  const ordersHref = (nextFilter: string, nextPage = 1) => {
    const params = new URLSearchParams({ filter: nextFilter, sort, category });
    if (search) params.set("q", search);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/admin/orders?${params}`;
  };
  const [listed, focused] = await Promise.all([
    getOrdersByIds(queue.ids),
    focusId ? getOrdersByIds([focusId]) : Promise.resolve([]),
  ]);
  const visible = [...focused, ...listed.filter((o) => o.id !== focusId)];
  const proofs = await getPaymentProofs(visible.flatMap(o => o.payments.filter(p => p.provider === "manual" && p.method_label === "Bank Transfer").map(p => p.id)));

  const filterItems = FILTERS.map(f => ({
    key: f.key, label: f.label, href: ordersHref(f.key),
    count: f.key === "all" ? queue.total : f.key === "action" ? queue.action : f.key === "upcoming" ? queue.upcoming : (queue.byStatus[f.key] ?? 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Orders & Payments" actions={<RefreshOrdersButton />} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        <StatTile
          label="Collected revenue"
          value={money(queue.settledRevenue, "USD")}
          hint={`${queue.settledCount} paid`}
        />
        <Link href="/admin/orders?filter=action" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"><StatTile
          label="Payment requests"
          value={String(queue.action)}
          tone={queue.action > 0 ? "warn" : undefined}
        /></Link>

      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <form key={`${category}:${filter}:${sort}:${search}`} role="search" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="filter" value={filter} />
        <div className="space-y-2"><label htmlFor="order-category" className="block text-xs font-medium text-muted-foreground">Service</label><select id="order-category" name="category" defaultValue={category} className={NATIVE_SELECT_CLASS}>{[["all","All services"],["visa","Visa"],["hotel","Hotels"],["flight","Flights"],["hall","Halls"],["umrah","Umrah"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="min-w-48 flex-1"><label htmlFor="order-search" className="mb-2 block text-xs font-medium text-muted-foreground">Find an order</label><Input id="order-search" name="q" defaultValue={search} placeholder="Order, visa reference, name or email" maxLength={100} /></div>
        <div className="space-y-2"><label htmlFor="order-sort" className="block text-xs font-medium text-muted-foreground">Sort orders</label><select id="order-sort" name="sort" defaultValue={sort} className={NATIVE_SELECT_CLASS}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
        <Button type="submit" variant="outline">Apply</Button>
        {(search || filter !== "all" || sort !== "newest" || category !== "all") ? <Button variant="ghost" render={<Link href="/admin/orders" />}>Reset</Button> : null}
      </form>
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips label="Filter orders" active={filter} showZero items={filterItems.filter(item => ["all", "action", "pending_payment", "paid"].includes(item.key))} />
        <details open={["upcoming", "partially_paid", "cancelled"].includes(filter)} className="text-sm">
          <summary className="cursor-pointer rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">More filters</summary>
          <div className="pt-3"><FilterChips label="Additional filters" active={filter} showZero items={filterItems.filter(item => ["upcoming", "partially_paid", "cancelled"].includes(item.key))} /></div>
        </details>
      </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{search ? `Results for “${search}”` : filter === "all" ? "All orders" : FILTERS.find(f=>f.key===filter)?.label}</h2><span className="text-xs text-muted-foreground tabular-nums">{queue.matching} {queue.matching === 1 ? "order" : "orders"}</span></div>

      {visible.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>{search ? "No matching orders" : filter === "action" ? "No payment requests awaiting review" : queue.total === 0 ? "No orders" : "No orders match this filter"}</EmptyTitle>
              <Button variant="outline" render={<Link href="/admin/orders?filter=all" />}>View all orders</Button>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((order) => {
            // invoices has a unique constraint on order_id, so PostgREST
            // embeds it as an object rather than an array.
            const invoice = order.invoices;
            const awaiting = order.payments.filter((p) => p.status === "requires_action");
            const paidTotal = order.payments
              .filter((p) => p.status === "succeeded")
              .reduce((sum, p) => sum + Number(p.amount), 0);
            const balanceDue = Number(order.total) - paidTotal;

            return (
              <Card key={order.id} id={`order-${order.id}`} className={cn("scroll-mt-24 gap-0 overflow-hidden border-l-[3px] border-l-primary py-0 shadow-sm", order.id === focusId && "ring-2 ring-primary")}>
                <OrderReadScope orderId={order.id} opened={order.id === focusId}>
                  <CardContent className="p-5 sm:p-6">
                    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr_1.35fr] lg:items-center">
                      <div className="min-w-0">
                        <Link href={`${ordersHref(filter)}&order=${order.id}#order-${order.id}`} className="rounded-md border border-border px-2 py-1 font-mono text-xs hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{order.order_number}</Link>
                        <ul className="mt-3 space-y-3">{order.order_items.map(item => {
                          const d = describeOrderItem(item);
                          const Icon = ITEM_ICON[d.type] ?? FileText;
                          const dates = travelWindow(d.from, d.to);
                          return <li key={item.id} className="flex items-center gap-4">
                            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary"><Icon className="size-7" aria-hidden="true" /></span>
                            <div className="min-w-0"><p className="break-words font-heading text-lg font-semibold">{d.title}</p>{dates ? <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4 shrink-0" aria-hidden="true" />{dates}</p> : null}{order.order_items.length > 1 ? <p className="mt-1 text-xs tabular-nums">{money(item.total_price,order.currency)}</p> : null}</div>
                          </li>;
                        })}</ul>
                      </div>
                      <div className="flex items-center gap-3 lg:border-l lg:border-border lg:px-5"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/8 text-primary"><UserRound className="size-5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">Customer</p><p className="mt-1 break-words text-sm font-semibold">{order.agency_customer?.full_name ?? order.customer?.full_name ?? "Customer"}</p></div></div>
                      <div className="flex flex-wrap items-center justify-between gap-3 lg:border-l lg:border-border lg:pl-5"><div><p className="text-xs text-muted-foreground">Payment amount</p><p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{money(order.total,order.currency)}</p>{paidTotal > 0 && balanceDue > 0.01 && ["pending_payment","held","partially_paid"].includes(order.status) ? <p className="text-xs text-muted-foreground">{money(balanceDue,order.currency)} due</p> : null}</div><Badge variant={statusBadgeVariant(order.status)} className="rounded-full px-3 py-1.5 capitalize">{order.status.replace(/_/g," ")}</Badge></div>
                    </div>

                    <div className="mt-5">
                      <OrderPaymentsPanel order={order} proofs={proofs} />
                      {order.order_items.map(item => {
                        const application = item.visa_application;
                        const review = application && visaReviewHandoff(application.status, order.status);
                        return application && review ? <div key={`review-${item.id}`} className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{review.message}</span><Button size="sm" variant="outline" render={<Link href={`/admin/visa/${application.id}?tab=documents`} />}>{review.label}</Button></div> : null;
                      })}
                      {!awaiting.some(payment => payment.provider === "manual") && balanceDue > 0.01 && !["cancelled", "refunded"].includes(order.status) ? <div className="mt-3"><RecordPaymentDialog orderId={order.id} remaining={balanceDue} currency={order.currency} /></div> : null}
                      <details className="group mt-4 border-t border-border pt-3 text-xs">
                        <summary className="w-fit cursor-pointer rounded-sm py-1 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">Order details</summary>
                        <div className="mt-3 space-y-4 rounded-lg bg-muted/30 p-4">
                          <div className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
                            {order.customer?.email ? <a href={`mailto:${order.customer.email}`} className="inline-flex items-center gap-1.5 break-all hover:text-foreground"><Mail className="size-3.5 shrink-0" aria-hidden="true" />{order.customer.email}</a> : null}
                            {order.customer?.phone ? <a href={`tel:${order.customer.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Phone className="size-3.5" aria-hidden="true" />{order.customer.phone}</a> : null}
                          </div>
                          <p className="text-muted-foreground">Placed {format(new Date(order.created_at), "d MMM yyyy, HH:mm")}{order.agency?.name ? ` · ${order.agency.name}` : ""}{order.agency_customer?.full_name && order.customer?.full_name ? ` · Booked by ${order.customer.full_name}` : ""}</p>
                          <ul className="space-y-2">{order.order_items.map(item => { const d = describeOrderItem(item); return <li key={item.id} className="text-muted-foreground">{[d.title, d.typeLabel, d.detail, d.status?.replace(/_/g, " "), item.quantity > 1 ? `Qty ${item.quantity}` : null].filter(Boolean).join(" · ")}{item.visa_application?.id ? <Link className="ml-2 text-primary hover:underline" href={`/admin/visa/${item.visa_application.id}`}>Open application</Link> : null}</li>; })}</ul>
                          <HotelBookingDetails order={order} />
                          <OrderPaymentsPanel order={order} proofs={proofs} historyOnly />
                          <div className="flex flex-wrap items-center gap-3"><OrderStatusSelect orderId={order.id} status={order.status} />{invoice ? <Button size="sm" variant="outline" render={<a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />}><Download aria-hidden="true" />Invoice</Button> : null}</div>
                        </div>
                      </details>
                    </div>
                  </CardContent>
                </OrderReadScope>
              </Card>
            );
          })}
        </div>
      )}

      <Pager page={page} total={queue.matching} hrefFor={(n) => ordersHref(filter, n)} />
    </div>
  );
}

