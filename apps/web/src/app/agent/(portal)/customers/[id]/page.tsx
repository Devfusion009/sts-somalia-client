import { notFound } from "next/navigation";
import { format } from "date-fns";
import { BackLink } from "@/components/back-link";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyCustomerDetail } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EditCustomerDialog, DeleteCustomerButton } from "./customer-actions-ui";

const ORDER_STATUS_STYLES: Record<string, string> = {
  held: "bg-brand-gold/15 text-brand-gold",
  pending_payment: "bg-brand-gold/15 text-brand-gold",
  paid: "bg-primary/10 text-primary",
  processing: "bg-chart-3/10 text-chart-3",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/10 text-destructive",
};

const ITEM_LABELS: Record<string, string> = {
  hotel: "Hotel",
  flight: "Flight",
  visa: "Visa",
  umrah: "Umrah",
  hall: "Event hall",
};

const PAID_STATUSES = ["paid", "processing", "completed"];

function money(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(0)}`;
}

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackLink href="/agent/customers" label="Customers" className="mb-3" />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">{customer.full_name}</h1>
            {customer.profile_id ? (
              <Badge className="border-transparent bg-primary/10 text-primary">STS account</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {[customer.email, customer.phone, `Added ${format(new Date(customer.created_at), "d MMM yyyy")}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EditCustomerDialog customer={customer} />
          <DeleteCustomerButton customerId={customer.id} hasBookings={orders.length > 0} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg bg-secondary/40 p-4 sm:grid-cols-4">
        {[
          { label: "Bookings", value: String(orders.length) },
          { label: "Total spent", value: spent > 0 ? money(spent, currency) : "—" },
          {
            label: "Last booking",
            value: lastBookingAt ? format(new Date(lastBookingAt), "d MMM yyyy") : "—",
          },
          { label: "Flight quotes", value: String(flightQuotes.length) },
        ].map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 font-heading text-lg font-bold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {customer.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{customer.notes}</CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Bookings</h2>
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No bookings for this customer yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {order.order_items.map((i) => ITEM_LABELS[i.item_type] ?? i.item_type).join(", ") ||
                          "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border-transparent capitalize",
                            ORDER_STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {money(Number(order.total), order.currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {format(new Date(order.created_at), "d MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </section>

      {flightQuotes.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Flight quotes</h2>
          <Card className="overflow-hidden py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Route</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flightQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">
                        {quote.origin_iata} → {quote.destination_iata}
                        {quote.return_at ? " (return)" : ""}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(quote.depart_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge className="border-transparent bg-muted capitalize text-muted-foreground">
                          {quote.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {format(new Date(quote.created_at), "d MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
