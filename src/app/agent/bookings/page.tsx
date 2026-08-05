import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Landmark,
  PartyPopper,
  Plane,
  Stamp,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyOrders } from "@/modules/agencies/queries";
import { describeOrderItem } from "@/modules/payments/queries";
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

const TYPE_ICON = {
  hotel: Building2,
  flight: Plane,
  visa: Stamp,
  umrah: Landmark,
  hall: PartyPopper,
} as const;

const ORDER_STATUS_STYLES: Record<string, string> = {
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
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const orders = await getAgencyOrders(membership.agency.id);
  const activeFilter = FILTERS.some((f) => f.key === type) ? (type as string) : "all";
  const filtered =
    activeFilter === "all"
      ? orders
      : orders.filter((o) => o.order_items.some((i) => i.item_type === activeFilter));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Agency Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Every booking made through {membership.agency.name} — across flights, hotels, visas,
          Umrah, and event halls.
        </p>
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
            <p className="text-sm text-muted-foreground">
              Bookings made while signed in to this account are attributed here automatically.
            </p>
            <Button className="mt-2" render={<Link href="/agent" />}>
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
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <p className="font-mono text-xs font-medium">{order.order_number}</p>
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
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.customer_id === order.booked_by ? "Walk-in / self" : "Client account"}
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
                        {order.currency} {Number(order.total).toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {order.status === "pending_payment" ? (
                          <Button size="sm" className="gap-1" render={<Link href={`/checkout/${order.id}`} />}>
                            Pay now <ArrowRight className="size-3.5" />
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
    </div>
  );
}
