import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Inbox, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { getSubmittedUmrahRequests } from "@/modules/umrah/custom-queries";
import { categoryLabel, ROOM_SHARING_LABELS, UMRAH_TIER_LABELS } from "@/modules/umrah/services";
import { formatMoney, tripDurationDays, tripReturnDate } from "@/modules/umrah/pricing";
import { UmrahRequestActions, UmrahPriceQuoteForm } from "./request-actions";
import { PriceAdjustment } from "@/modules/umrah/components/price-adjustment";

export const metadata = { title: "Private Umrah Requests" };

function formatDate(value: string | null) {
  if (!value) return "Dates to confirm";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Private Umrah requests waiting on a human, newest first.
 *
 * These are quoted, not open-ended: the customer has already seen and agreed
 * a total built from the service catalog. What still needs a person is
 * availability — the hotels, the seats and the visa slots for those exact
 * dates. Confirming here is what lets the customer pay.
 */
export default async function AdminUmrahRequestsPage() {
  const requests = await getSubmittedUmrahRequests();
  const pending = requests.filter((r) => {
    const booking = Array.isArray(r.booking) ? r.booking[0] : r.booking;
    return !booking || booking.status === "pending";
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Private Umrah requests"
        status={
          pending.length > 0 ? (
            <Badge variant="warning" className="tabular-nums">
              {pending.length} waiting
            </Badge>
          ) : null
        }
        actions={
          <Button variant="outline" render={<Link href="/admin/catalog/umrah/services" />}>
            <Settings2 aria-hidden="true" /> Service prices
          </Button>
        }
      />

      {requests.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>No private Umrah requests</EmptyTitle>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request, i) => {
            const booking = Array.isArray(request.booking) ? request.booking[0] : request.booking;
            const customer = Array.isArray(request.customer)
              ? request.customer[0]
              : request.customer;
            const trip = {
              numPilgrims: request.num_pilgrims,
              nightsMakkah: request.nights_makkah,
              nightsMadinah: request.nights_madinah,
            };
            const duration = tripDurationDays(trip);
            const returnDate = tripReturnDate(request.departure_date, trip);
            const price = booking ? Number(booking.total_price) : request.subtotal;
            const currency = booking?.currency ?? request.currency;
            const settled = booking && booking.status !== "pending";

            return (
              <Card key={request.id} className="gap-0 overflow-hidden py-0">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <span className="w-6 shrink-0 pt-0.5 text-sm font-semibold text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          <span className="font-mono text-sm">{request.reference}</span>
                          <Badge variant="neutral">{UMRAH_TIER_LABELS[request.tier]}</Badge>
                          {booking ? (
                            <Badge
                              variant={booking.status === "pending" ? "warning" : statusBadgeVariant(booking.status)}
                              className="capitalize"
                            >
                              {booking.status === "pending" ? "New request" : booking.status.replace(/_/g, " ")}
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {formatDate(request.departure_date)}
                          {returnDate ? ` – ${formatDate(returnDate)}` : ""} · {duration} days ·{" "}
                          {request.num_pilgrims} traveller{request.num_pilgrims > 1 ? "s" : ""} ·{" "}
                          {ROOM_SHARING_LABELS[request.room_sharing] ?? request.room_sharing} room ·{" "}
                          {request.nights_makkah} nights Makkah / {request.nights_madinah} Madinah
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {customer?.full_name ?? customer?.email ?? "Customer"}
                          {customer?.phone ? ` · ${customer.phone}` : ""} · Created{" "}
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 pl-9 sm:items-end sm:pl-0">
                      <p className="font-heading text-xl font-semibold tabular-nums">{formatMoney(price, currency)}</p>
                      {booking && !settled ? <UmrahRequestActions bookingId={booking.id} /> : null}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-4">
                    <h3 className="text-xs font-medium text-muted-foreground">Selected services</h3>
                    <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      {request.services.map((line) => (
                        <li key={line.id} className="flex justify-between gap-3 text-sm">
                          <span className="min-w-0">
                            <span className="font-medium">{line.name}</span>
                            <span className="block text-xs text-muted-foreground tabular-nums">
                              {categoryLabel(line.category)} · {formatMoney(line.unit_price, currency)} × {line.quantity}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums">{formatMoney(line.line_total, currency)}</span>
                        </li>
                      ))}
                      <PriceAdjustment total={price} lines={request.services} currency={currency} />
                    </ul>
                    {request.notes ? (
                      <p className="mt-2 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                        <span className="text-xs text-muted-foreground">Customer notes · </span>
                        {request.notes}
                      </p>
                    ) : null}
                  </div>

                  {booking && !settled ? (
                    <UmrahPriceQuoteForm
                      bookingId={booking.id}
                      currentPrice={price}
                      currency={currency}
                    />
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
