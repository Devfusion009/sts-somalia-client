import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  Building2,
  Download,
  Landmark,
  PartyPopper,
  Plane,
  Plus,
  Receipt,
  Stamp,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyOrders } from "@/modules/agencies/queries";
import { describeOrderItem } from "@/modules/orders/format";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { money } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parsePage } from "@/lib/pagination";
import { Pager } from "@/components/dashboard/pager";
import { CancelOrderButton } from "@/modules/orders/components/cancel-order-button";

const TYPE_ICON = {
  hotel: Building2,
  flight: Plane,
  visa: Stamp,
  umrah: Landmark,
  hall: PartyPopper,
} as const;

export const metadata = { title: "Bookings" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "flight", label: "Flights" },
  { key: "hotel", label: "Hotels" },
  { key: "visa", label: "Visa" },
  { key: "umrah", label: "Umrah" },
  { key: "hall", label: "Events" },
] as const;

export default async function AgentBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const { type, page: pageParam } = await searchParams;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const activeFilter = FILTERS.find((f) => f.key === type)?.key ?? "all";
  const page = parsePage(pageParam);
  const { orders: filtered, total } = await getAgencyOrders(membership.agency.id, {
    page,
    type: activeFilter === "all" ? undefined : activeFilter,
  });
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    if (activeFilter !== "all") params.set("type", activeFilter);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/agent/bookings?${qs}` : "/agent/bookings";
  };
  // A page past the end (stale link, filter just changed) comes back empty.
  if (page > 1 && filtered.length === 0) redirect(hrefFor(1));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        actions={
          <Button render={<Link href="/agent/book" />}>
            <Plus data-icon="inline-start" aria-hidden="true" /> New booking
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
      <FilterChips
        label="Filter bookings"
        active={activeFilter}
        items={FILTERS.map((filter) => ({
          key: filter.key,
          label: filter.label,
          href: filter.key === "all" ? "/agent/bookings" : `/agent/bookings?type=${filter.key}`,
        }))}
      />
      <span className="text-xs text-muted-foreground tabular-nums">{total} booking{total === 1 ? "" : "s"}</span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>{activeFilter === "all" ? "No bookings" : "No bookings in this category"}</EmptyTitle>
            <EmptyContent>
              <Button render={<Link href="/agent/book" />}>Start a booking</Button>
            </EmptyContent>
          </Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Total</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const paid = order.payments.find((p) => p.status === "succeeded");
                // Manual hotels seeded "price on request" sit at total 0
                // until STS quotes them from the admin queue — offering
                // "Pay now" on those reads as a free booking.
                const awaitingPrice =
                  Number(order.total) === 0 &&
                  (order.status === "pending_payment" || order.status === "held");
                return (
                  <TableRow key={order.id}>
                    <TableCell className="align-top">
                      <Link
                        href={`/agent/bookings/${order.id}`}
                        className="rounded-sm font-mono text-xs font-semibold tabular-nums outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {order.order_number}
                      </Link>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(order.created_at), "d MMM yyyy")}
                      </p>
                    </TableCell>
                    <TableCell className="align-top">
                      <ul className="space-y-2">
                        {order.order_items.map((item) => {
                          const info = describeOrderItem(item);
                          const Icon = TYPE_ICON[item.item_type];
                          return (
                            <li key={item.id} className="flex items-start gap-2">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                              <div className="min-w-0 max-w-72">
                                <p className="truncate text-sm font-medium">{info.title}</p>
                                {info.subtitle ? (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {info.subtitle}
                                  </p>
                                ) : null}
                                {item.item_type === "hotel" && item.hotel_booking?.status === "waitlisted" ? (
                                  <Badge variant="warning" className="mt-1">
                                    Waitlisted
                                  </Badge>
                                ) : item.item_type === "hotel" && item.hotel_booking?.status === "confirmed" ? (
                                  <Badge variant="success" className="mt-1">
                                    Room confirmed
                                  </Badge>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      {order.agency_customer ? (
                        <>
                          <p className="font-medium">{order.agency_customer.full_name}</p>
                          {order.agency_customer.phone ? (
                            <p className="text-xs text-muted-foreground">
                              {order.agency_customer.phone}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {order.customer_id === order.booked_by ? "Walk-in / self" : "Client account"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col items-start gap-1">
                        {awaitingPrice ? (
                          <Badge variant="warning">Awaiting price</Badge>
                        ) : (
                          <Badge variant={statusBadgeVariant(order.status)} className="capitalize">
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {paid?.method_label ? (
                          <span className="text-xs text-muted-foreground">{paid.method_label}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell numeric className="align-top font-medium">
                      {awaitingPrice ? (
                        <span className="text-muted-foreground">On request</span>
                      ) : (
                        money(Number(order.total), order.currency)
                      )}
                    </TableCell>
                    <TableCell numeric className="align-top">
                      {awaitingPrice ? (
                        <div className="flex justify-end">
                          <CancelOrderButton orderId={order.id} redirectTo="/agent/bookings" label="Cancel" />
                        </div>
                      ) : order.status === "held" || order.status === "pending_payment" ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" render={<Link href={`/agent/book/order/${order.id}`} />}>
                            Pay now <ArrowRight data-icon="inline-end" aria-hidden="true" />
                          </Button>
                          <CancelOrderButton orderId={order.id} redirectTo="/agent/bookings" label="Cancel" />
                        </div>
                      ) : order.status === "paid" ||
                        order.status === "processing" ||
                        order.status === "completed" ? (
                        <Button
                          size="icon-sm"
                          variant="outline"
                          aria-label={`Invoice for ${order.order_number}`}
                          title="Invoice"
                          render={
                            <a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />
                          }
                        >
                          <Download aria-hidden="true" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
