import { AgentMoney } from "@/components/portal/agent-money";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Plane, Receipt } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyCustomerDetail } from "@/modules/agencies/queries";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditCustomerDialog, DeleteCustomerButton } from "./customer-actions-ui";

export const metadata = { title: "Customer" };

const ITEM_LABELS: Record<string, string> = {
  hotel: "Hotel",
  flight: "Flight",
  visa: "Visa",
  umrah: "Umrah",
  hall: "Event hall",
};

const PAID_STATUSES = ["paid", "processing", "completed"];

export default async function AgentCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { id } = await params;
  const detail = await getAgencyCustomerDetail(membership.agency.id, id);
  if (!detail) notFound();

  const { customer, orders, flightQuotes } = detail;
  const spent = orders
    .filter((o) => PAID_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + Number(o.total), 0);
  const currency = orders[0]?.currency ?? "USD";
  const lastBookingAt = orders[0]?.created_at ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <BackLink href="/agent/customers" label="Customers" />
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">
                {customer.full_name}
              </h1>
              {customer.profile_id ? <Badge variant="info">STS account</Badge> : null}
            </div>
            <p className="text-sm break-words text-muted-foreground">
              {[customer.email, customer.phone, `Added ${format(new Date(customer.created_at), "d MMM yyyy")}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <EditCustomerDialog customer={customer} />
            <DeleteCustomerButton customerId={customer.id} hasBookings={orders.length > 0} />
          </div>
        </header>
      </div>

      <StatRail>
        <StatRailItem label="Bookings" value={orders.length} />
        <StatRailItem label="Total spent" value={spent > 0 ? <AgentMoney value={money(spent, currency)} /> : "—"} />
        <StatRailItem
          label="Last booking"
          value={lastBookingAt ? format(new Date(lastBookingAt), "d MMM yyyy") : "—"}
        />
        <StatRailItem label="Flight quotes" value={flightQuotes.length} />
      </StatRail>

      {customer.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-line text-muted-foreground">
            {customer.notes}
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-base font-semibold">Bookings</h2>
          {orders.length > 0 ? (
            <Badge variant="neutral" className="tabular-nums">
              {orders.length}
            </Badge>
          ) : null}
        </div>
        <Card className="overflow-hidden py-0">
          {orders.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>No bookings</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>Total</TableHead>
                  <TableHead numeric>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`/agent/bookings/${order.id}`}
                        className="rounded-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {order.order_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.order_items.map((i) => ITEM_LABELS[i.item_type] ?? i.item_type).join(", ") ||
                        "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(order.status)} className="capitalize">
                        {order.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell numeric className="text-sm font-medium">
                      {<AgentMoney value={money(Number(order.total), order.currency)} />}
                    </TableCell>
                    <TableCell numeric className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      {flightQuotes.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold">Flight quotes</h2>
            <Badge variant="neutral" className="tabular-nums">
              {flightQuotes.length}
            </Badge>
          </div>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flightQuotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <Plane className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        {quote.origin_iata} → {quote.destination_iata}
                        {quote.return_at ? (
                          <span className="font-normal text-muted-foreground">Return</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(quote.depart_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(quote.status)} className="capitalize">
                        {quote.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell numeric className="text-sm text-muted-foreground">
                      {format(new Date(quote.created_at), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
