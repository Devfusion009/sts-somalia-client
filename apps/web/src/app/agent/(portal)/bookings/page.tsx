import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Download,
  Landmark,
  PartyPopper,
  Plane,
  Plus,
  Stamp,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyOrders } from "@/modules/agencies/queries";
import { describeOrderItem } from "@/modules/orders/format";
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

const ORDER_STATUS_STYLES: Record<string, string> = {
  held: "bg-brand-gold/15 text-brand-gold",
  pending_payment: "bg-brand-gold/15 text-brand-gold",
  paid: "bg-primary/10 text-primary",
  processing: "bg-chart-3/10 text-chart-3",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/10 text-destructive",
};

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Agency Bookings</h1>
        <Button className="gap-1.5" render={<Link href="/agent/book" />}>
          <Plus className="size-4" /> New booking
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Button
            key={filter.key}
            variant={activeFilter === filter.key ? "default" : "outline"}
            size="sm"
            render={
              <Link
                href={filter.key === "all" ? "/agent/bookings" : `/agent/bookings?type=${filter.key}`}
              />
            }
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-medium">No bookings {activeFilter !== "all" ? "in this category " : ""}yet</p>
            <Button className="mt-2" render={<Link href="/agent/book" />}>
              Start a booking
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Action</TableHead>
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
                      <TableCell>
                        <Link
                          href={`/agent/bookings/${order.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {order.order_number}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), "d MMM yyyy")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {order.order_items.map((item) => {
                            const info = describeOrderItem(item);
                            const Icon = TYPE_ICON[item.item_type];
                            return (
                              <div key={item.id} className="flex items-center gap-2">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                                  <Icon className="size-3.5" />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{info.title}</p>
                                  {info.subtitle ? (
                                    <p className="truncate text-xs text-muted-foreground">
                                      {info.subtitle}
                                    </p>
                                  ) : null}
                                  {item.item_type === "hotel" && item.hotel_booking?.status === "waitlisted" ? (
                                    <Badge className="mt-0.5 border-transparent bg-brand-gold/15 text-brand-gold">Waitlisted</Badge>
                                  ) : item.item_type === "hotel" && item.hotel_booking?.status === "confirmed" ? (
                                    <Badge className="mt-0.5 border-transparent bg-primary/10 text-primary">Room confirmed</Badge>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
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
                            {order.customer_id === order.booked_by
                              ? "Walk-in / self"
                              : "Client account"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            className={cn(
                              "border-transparent capitalize",
                              ORDER_STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"
                            )}
                          >
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                          {paid?.method_label ? (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <CreditCard className="size-3" /> {paid.method_label}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {awaitingPrice
                          ? "On request"
                          : `${order.currency} ${Number(order.total).toFixed(0)}`}
                      </TableCell>
                      <TableCell className="text-right">
                        {awaitingPrice ? (
                          <div className="flex items-center justify-end gap-2">
                            <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">
                              Awaiting price
                            </Badge>
                            <CancelOrderButton
                              orderId={order.id}
                              redirectTo="/agent/bookings"
                              label="Cancel"
                            />
                          </div>
                        ) : order.status === "held" || order.status === "pending_payment" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              className="gap-1"
                              render={<Link href={`/agent/book/order/${order.id}`} />}
                            >
                              Pay now <ArrowRight className="size-3.5" />
                            </Button>
                            <CancelOrderButton orderId={order.id} redirectTo="/agent/bookings" label="Cancel" />
                          </div>
                        ) : order.status === "paid" ||
                          order.status === "processing" ||
                          order.status === "completed" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            render={
                              <a
                                href={`/api/invoices/${order.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                          >
                            <Download className="size-3.5" /> Invoice
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
