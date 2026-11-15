import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Plane } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/money";
import { RetryTicketingForm } from "./retry-form";

export const metadata = { title: "Flight bookings" };

const STATUS: Record<string, { label: string; variant: "neutral" | "info" | "success" | "destructive" }> = {
  awaiting_payment: { label: "Awaiting payment", variant: "neutral" },
  queued: { label: "Booking", variant: "info" },
  booking: { label: "Booking", variant: "info" },
  booked: { label: "Booked · ticket pending", variant: "info" },
  ticketed: { label: "Ticketed", variant: "success" },
  failed: { label: "Needs attention", variant: "destructive" },
  pending: { label: "Pending", variant: "info" },
  confirmed: { label: "Confirmed", variant: "success" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "neutral" },
  refunded: { label: "Refunded", variant: "neutral" },
  no_show: { label: "No show", variant: "neutral" },
  expired: { label: "Fare expired", variant: "neutral" },
};

const FILTERS = [
  { key: "all", label: "All", statuses: null, legacy: null },
  { key: "attention", label: "Needs attention", statuses: ["failed"], legacy: ["failed"] },
  { key: "pending", label: "In progress", statuses: ["queued", "booking", "booked"], legacy: ["pending", "confirmed"] },
  { key: "ticketed", label: "Ticketed", statuses: ["ticketed"], legacy: null },
  { key: "unpaid", label: "Awaiting payment", statuses: ["awaiting_payment"], legacy: null },
] as const;

function day(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function AdminFlightBookingsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  await requirePlatformAdmin();
  const { view, page: pageParam } = await searchParams;
  const filter = FILTERS.find((f) => f.key === view) ?? FILTERS[0];
  const parsedPage = Number(pageParam ?? 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = 50;
  let query = createAdminClient()
    .from("flight_bookings")
    .select(
      "id, agency_id, status, origin_iata, destination_iata, depart_at, return_at, total_price, currency, ticketing_status, ticketing_error, provider_booking_ref, provider_order_id, ticket_numbers, created_at, agency:agency_id(name), customer:customer_id(full_name, email), agency_customer:agency_customer_id(full_name), booked_by_profile:booked_by(full_name, email), passengers:flight_passengers(full_name), order_items(order:orders(id, order_number))",
      { count: "exact" }
    );
  if (filter.statuses) {
    const ticketing = `ticketing_status.in.(${filter.statuses.join(",")})`;
    query = filter.legacy
      ? query.or(`${ticketing},and(ticketing_status.is.null,status.in.(${filter.legacy.join(",")}))`)
      : query.in("ticketing_status", [...filter.statuses]);
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error("Flight bookings could not be loaded.");
  const shown = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const pageHref = (target: number) => `/admin/flights?view=${filter.key}&page=${target}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Flight bookings" />

      <FilterChips
        label="Filter flight bookings"
        active={filter.key}
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "all" ? "/admin/flights" : `/admin/flights?view=${f.key}`,
        }))}
      />

      <Card className="overflow-hidden py-0">
        {shown.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Plane />
            </EmptyMedia>
            <EmptyTitle>No flight bookings</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Passengers</TableHead>
                <TableHead>Customer · booking source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PNR · tickets</TableHead>
                <TableHead numeric>Fare</TableHead>
                <TableHead numeric>Booked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((b) => {
                const statusKey = b.ticketing_status ?? b.status;
                const status = STATUS[statusKey] ?? { label: statusKey, variant: "neutral" as const };
                const agency = Array.isArray(b.agency) ? b.agency[0] : b.agency;
                const customer = Array.isArray(b.customer) ? b.customer[0] : b.customer;
                const agencyCustomer = Array.isArray(b.agency_customer) ? b.agency_customer[0] : b.agency_customer;
                const bookedBy = Array.isArray(b.booked_by_profile) ? b.booked_by_profile[0] : b.booked_by_profile;
                const item = b.order_items?.[0];
                const order = item ? (Array.isArray(item.order) ? item.order[0] : item.order) : null;
                return (
                  <TableRow key={b.id} className="align-top">
                    <TableCell>
                      <p className="font-mono text-sm font-semibold">
                        {b.origin_iata} → {b.destination_iata}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {day(b.depart_at)}
                        {b.return_at ? ` – ${day(b.return_at)}` : " · one way"}
                      </p>
                      {order ? (
                        <Link href={`/admin/orders?order=${order.id}#order-${order.id}`} className="font-mono text-xs text-primary hover:underline">
                          {order.order_number}
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-56 text-sm">
                      <p className="truncate">{(b.passengers ?? []).map((p) => p.full_name).join(", ") || "—"}</p>
                    </TableCell>
                    <TableCell className="max-w-56 text-sm">
                      <p className="truncate">{agencyCustomer?.full_name ?? customer?.full_name ?? customer?.email ?? "—"}</p>
                      <Badge variant="neutral">{b.agency_id ? "B2B" : "B2C"}</Badge>
                      {b.agency_id ? (
                        <>
                          <p className="truncate text-xs text-muted-foreground">{agency?.name ?? "Agency"}</p>
                          <p className="truncate text-xs text-muted-foreground">{bookedBy?.full_name ?? bookedBy?.email ?? "—"}</p>
                        </>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-64">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {b.ticketing_status === "failed" ? (
                        <div className="mt-2 space-y-2">
                          {b.ticketing_error ? <p className="text-xs break-words text-destructive">{b.ticketing_error}</p> : null}
                          {!b.provider_order_id ? <RetryTicketingForm bookingId={b.id} /> : null}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <p className="font-semibold">{b.provider_booking_ref ?? "—"}</p>
                      {(b.ticket_numbers ?? []).map((t) => (
                        <p key={t} className="text-muted-foreground">
                          {t}
                        </p>
                      ))}
                    </TableCell>
                    <TableCell numeric className="whitespace-nowrap tabular-nums">
                      {money(Number(b.total_price), b.currency)}
                    </TableCell>
                    <TableCell numeric className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      {totalPages > 1 || page > 1 ? (
        <nav aria-label="Flight bookings pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="text-primary hover:underline">Previous</Link> : <span />}
          <span>Page {page} · {count ?? 0} bookings</span>
          {page < totalPages ? <Link href={pageHref(page + 1)} className="text-primary hover:underline">Next</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
