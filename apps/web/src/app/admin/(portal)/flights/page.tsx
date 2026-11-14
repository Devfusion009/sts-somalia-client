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
  expired: { label: "Fare expired", variant: "neutral" },
};

const FILTERS = [
  { key: "all", label: "All", statuses: null },
  { key: "attention", label: "Needs attention", statuses: ["failed"] },
  { key: "pending", label: "In progress", statuses: ["queued", "booking", "booked"] },
  { key: "ticketed", label: "Ticketed", statuses: ["ticketed"] },
  { key: "unpaid", label: "Awaiting payment", statuses: ["awaiting_payment"] },
] as const;

function day(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function AdminFlightBookingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requirePlatformAdmin();
  const { view } = await searchParams;
  const { data } = await createAdminClient()
    .from("flight_bookings")
    .select(
      "id, origin_iata, destination_iata, depart_at, return_at, total_price, currency, ticketing_status, ticketing_error, provider_booking_ref, provider_order_id, ticket_numbers, created_at, agency:agency_id(name), customer:customer_id(full_name, email), passengers:flight_passengers(full_name), order_items(order:orders(id, order_number))"
    )
    .not("ticketing_status", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  const bookings = data ?? [];

  const filter = FILTERS.find((f) => f.key === view) ?? FILTERS[0];
  const shown = filter.statuses ? bookings.filter((b) => (filter.statuses as readonly string[]).includes(b.ticketing_status ?? "")) : bookings;
  const failed = bookings.filter((b) => b.ticketing_status === "failed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flight bookings"
        status={
          failed > 0 ? (
            <Badge variant="destructive" className="tabular-nums">
              {failed} need attention
            </Badge>
          ) : null
        }
      />

      <FilterChips
        label="Filter flight bookings"
        active={filter.key}
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "all" ? "/admin/flights" : `/admin/flights?view=${f.key}`,
          count: f.statuses ? bookings.filter((b) => (f.statuses as readonly string[]).includes(b.ticketing_status ?? "")).length : bookings.length,
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
                <TableHead>Status</TableHead>
                <TableHead>PNR · tickets</TableHead>
                <TableHead numeric>Fare</TableHead>
                <TableHead numeric>Booked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((b) => {
                const status = STATUS[b.ticketing_status ?? ""] ?? { label: b.ticketing_status ?? "—", variant: "neutral" as const };
                const agency = Array.isArray(b.agency) ? b.agency[0] : b.agency;
                const customer = Array.isArray(b.customer) ? b.customer[0] : b.customer;
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
                      <p className="truncate text-xs text-muted-foreground">{agency?.name ?? customer?.full_name ?? customer?.email}</p>
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
    </div>
  );
}
