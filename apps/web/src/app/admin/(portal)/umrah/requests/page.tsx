import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { BedDouble, CalendarDays, Inbox, Settings2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSubmittedUmrahRequests } from "@/modules/umrah/custom-queries";
import { categoryLabel, ROOM_SHARING_LABELS, UMRAH_TIER_LABELS } from "@/modules/umrah/services";
import { formatMoney, tripDurationDays, tripReturnDate } from "@/modules/umrah/pricing";
import { UmrahRequestActions, UmrahPriceQuoteForm } from "./request-actions";

export const metadata = { title: "Private Umrah Requests | Admin Console" };

function formatDate(value: string | null) {
  if (!value) return "dates to confirm";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-xl font-semibold">Private Umrah requests</h1>
          <Badge variant="secondary">{pending.length} waiting</Badge>
        </div>
        <Button
          render={<Link href="/admin/catalog/umrah/services" />}
          variant="outline"
          className="gap-2"
        >
          <Settings2 className="size-4" /> Edit service prices
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Inbox className="size-6" />
            No private Umrah requests have been submitted yet.
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
              <Card key={request.id} className={settled ? "opacity-70" : undefined}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <span className="font-heading text-lg font-bold text-muted-foreground/60">
                        #{i + 1}
                      </span>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Settings2 className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          <span className="font-mono text-sm">{request.reference}</span>
                          <Badge variant="secondary">{UMRAH_TIER_LABELS[request.tier]}</Badge>
                          {booking ? (
                            <Badge
                              className={
                                booking.status === "confirmed"
                                  ? "border-transparent bg-primary/10 text-primary"
                                  : booking.status === "cancelled"
                                    ? "border-transparent bg-destructive/10 text-destructive"
                                    : undefined
                              }
                              variant={booking.status === "pending" ? "secondary" : "default"}
                            >
                              {booking.status === "pending" ? "New request" : booking.status}
                            </Badge>
                          ) : null}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="size-3.5" />
                            {formatDate(request.departure_date)}
                            {returnDate ? ` – ${formatDate(returnDate)}` : ""} · {duration} days
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="size-3.5" />
                            {request.num_pilgrims} traveller
                            {request.num_pilgrims > 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <BedDouble className="size-3.5" />
                            {ROOM_SHARING_LABELS[request.room_sharing] ?? request.room_sharing} room
                          </span>
                          <span>
                            {request.nights_makkah} nights Makkah / {request.nights_madinah} nights
                            Madinah
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {customer?.full_name ?? customer?.email ?? "Customer"}
                          {customer?.phone ? ` · ${customer.phone}` : ""} · submitted{" "}
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <p className="font-heading text-xl font-bold text-primary">
                        {formatMoney(price, currency)}
                      </p>
                      {booking && !settled ? <UmrahRequestActions bookingId={booking.id} /> : null}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-xs font-bold text-muted-foreground">
                      What they chose
                    </p>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {request.services.map((line) => (
                        <li key={line.id} className="flex justify-between gap-3 text-sm">
                          <span className="min-w-0">
                            <span className="font-medium">{line.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {categoryLabel(line.category)} ·{" "}
                              {formatMoney(line.unit_price, currency)} × {line.quantity}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {formatMoney(line.line_total, currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {request.notes ? (
                      <p className="mt-3 border-t border-border pt-2 text-sm">
                        <span className="text-xs text-muted-foreground">Customer notes: </span>
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
