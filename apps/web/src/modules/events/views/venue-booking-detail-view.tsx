import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Check, CircleDot, CreditCard, Mail, PartyPopper, Phone, RotateCcw, StickyNote, User } from "lucide-react";
import { todayIso } from "@/modules/hotels/availability";
import { getHallBookingDetail, type HallEvent } from "@/modules/events/hall-detail-queries";
import { markHallBookingPaid, setHallBookingStatus } from "@/modules/events/venue-manager-actions";
import {
  HALL_STATUS_BADGE,
  PAYMENT_METHOD_LABEL,
  shortTime,
  type OfflinePaymentMethod,
} from "@/modules/events/venue-desk-types";
import type { VenueAccess } from "@/modules/events/venue-access";
import { HallMoveActions } from "@/modules/events/components/hall-move-actions";
import { DeskPriceForm } from "@/modules/events/components/venue-desk-controls";
import { BackLink } from "@/components/back-link";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const REQUEST_KIND = { cancellation: "Cancellation", refund: "Refund", modification: "Change" } as const;

function money(currency: string, amount: number | string) {
  return `${currency} ${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function day(iso: string) {
  return format(new Date(`${iso}T00:00:00`), "EEE d MMM yyyy");
}

function providerLabel(value: string) {
  return PAYMENT_METHOD_LABEL[value as OfflinePaymentMethod] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function eventTitle(e: HallEvent, currency: string) {
  switch (e.kind) {
    case "created":
      return "Booking created";
    case "status":
      return `Marked ${(e.toValue ?? "").replace(/_/g, " ")}`;
    case "payment":
      return e.toValue ? `Payment received · ${providerLabel(e.toValue)}` : "Payment received";
    case "refund":
      return "Refund sent";
    case "price":
      return `Price set · ${money(currency, e.toValue ?? 0)}`;
    case "rescheduled":
      return `Dates changed · ${e.toValue ?? ""}`;
  }
}

function actor(e: HallEvent, viewerId: string) {
  if (!e.actorId) return "System";
  return e.actorId === viewerId ? "You" : "Staff";
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-secondary/40 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-base font-semibold">{value}</dd>
    </div>
  );
}

export async function VenueBookingDetailView({
  venueId,
  bookingId,
  base,
  access,
}: {
  venueId: string;
  bookingId: string;
  base: string;
  access: VenueAccess;
}) {
  const detail = await getHallBookingDetail(venueId, bookingId);
  if (!detail) notFound();
  const { booking: b, order, onlinePayment, requests, events, quote } = detail;

  const today = todayIso();
  const canManage = access.can("bookings");
  const open = b.status === "pending" || b.status === "waitlisted";
  const live = open || b.status === "confirmed";
  const isOffline = b.source === "offline";
  const paid = Boolean(b.paid_at) || Boolean(onlinePayment);
  const channel = b.channel === "b2b" ? (b.agency?.name ?? "Agency") : isOffline ? "Desk" : "Online";
  const from = shortTime(b.start_time);
  const to = shortTime(b.end_time);
  const dates = b.start_date === b.end_date ? day(b.start_date) : `${day(b.start_date)} – ${day(b.end_date)}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackLink href={`${base}/bookings`} label="Bookings" />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-heading text-2xl font-semibold">{b.event_name || b.event_type}</h1>
              <Badge className={cn("border-transparent capitalize", HALL_STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground")}>
                {b.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="font-mono">{b.booking_ref}</span> · {channel} · Booked {format(new Date(b.created_at), "d MMM yyyy, HH:mm")}
            </p>
          </div>
        </div>
        {canManage ? (
          <HallMoveActions
            booking={b}
            today={today}
            isAdmin={access.isAdmin}
            action={setHallBookingStatus}
            fields={{ venueId }}
          />
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        <Fact label="Date" value={dates} />
        <Fact label="Time" value={from && to ? `${from}–${to}` : from ? `From ${from}` : "All day"} />
        <Fact label="Guests" value={b.expected_guests ?? "—"} />
        <Fact label="Price" value={Number(b.price) > 0 ? money(b.currency, b.price) : "Not set"} />
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PartyPopper className="size-4 text-primary" /> Event
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2">
                <div className="bg-card px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="font-medium capitalize">{b.event_type}</dd>
                </div>
                <div className="bg-card px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Name</dt>
                  <dd className="font-medium">{b.event_name || "—"}</dd>
                </div>
              </dl>
              {b.setup_requirements ? (
                <div className="flex gap-2 rounded-lg bg-secondary/40 px-3 py-2.5 text-sm">
                  <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{b.setup_requirements}</span>
                </div>
              ) : null}
              {b.customer_notes ? (
                <div className="flex gap-2 rounded-lg bg-secondary/40 px-3 py-2.5 text-sm">
                  <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{b.customer_notes}</span>
                </div>
              ) : null}
              {canManage && open && !isOffline ? (
                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-sm font-medium">Price</p>
                  <DeskPriceForm venueId={venueId} bookingId={b.id} price={Number(b.price)} currency={b.currency} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4 text-primary" /> Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{b.contact_name ?? "Client"}</p>
              {b.contact_phone ? (
                <a href={`tel:${b.contact_phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Phone className="size-3.5" /> {b.contact_phone}
                </a>
              ) : null}
              {b.contact_email ? (
                <a href={`mailto:${b.contact_email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Mail className="size-3.5" /> {b.contact_email}
                </a>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-primary" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-3">
                <div className="bg-card px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Amount</dt>
                  <dd className="font-medium">{money(b.currency, b.price)}</dd>
                </div>
                <div className="bg-card px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Method</dt>
                  <dd className="font-medium">
                    {isOffline
                      ? b.payment_method
                        ? PAYMENT_METHOD_LABEL[b.payment_method as OfflinePaymentMethod]
                        : "—"
                      : onlinePayment
                        ? (onlinePayment.label ?? providerLabel(onlinePayment.provider))
                        : "Online"}
                  </dd>
                </div>
                <div className="bg-card px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="font-medium">
                    {paid ? (
                      <span className="flex items-center gap-1 text-primary">
                        <Check className="size-4" /> Paid
                      </span>
                    ) : order?.status === "refunded" ? (
                      <span className="text-destructive">Refunded</span>
                    ) : (
                      <span className="text-brand-gold">Unpaid</span>
                    )}
                  </dd>
                </div>
              </dl>
              {order ? (
                <p className="text-sm text-muted-foreground">
                  Order <span className="font-mono">{order.number}</span> · <span className="capitalize">{order.status.replace(/_/g, " ")}</span>
                </p>
              ) : null}
              {b.payment_reference ? <p className="text-sm text-muted-foreground">Reference {b.payment_reference}</p> : null}
              {quote && quote.paidAmount > 0 && live ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Refund if cancelled today </span>
                  <span className="font-medium">
                    {quote.refundAmount !== null
                      ? `${money(b.currency, quote.refundAmount)} (${quote.deductionPercent}% deducted)`
                      : "No refund rules set"}
                  </span>
                </p>
              ) : null}
              {canManage && isOffline && !b.paid_at && live ? (
                <form action={markHallBookingPaid}>
                  <input type="hidden" name="bookingId" value={b.id} />
                  <input type="hidden" name="venueId" value={venueId} />
                  <SubmitButton size="sm" variant="outline" pendingText="Saving…">
                    Mark paid
                  </SubmitButton>
                </form>
              ) : null}
            </CardContent>
          </Card>

          {requests.length > 0 ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RotateCcw className="size-4 text-primary" /> Requests
                </CardTitle>
                <Link href={`${base}/refunds`} className="text-sm font-medium text-primary hover:underline">
                  Refunds
                </Link>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {requests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{REQUEST_KIND[r.kind]}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.reason}</p>
                      </div>
                      <span className="shrink-0 text-right text-sm">
                        <span className="capitalize">{r.status.replace(/_/g, " ")}</span>
                        {r.approved_amount !== null ? (
                          <span className="block text-xs text-muted-foreground">{money(b.currency, r.approved_amount)}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {[...events].reverse().map((e) => (
                  <li key={e.id} className="relative">
                    <CircleDot className="absolute -left-[1.6rem] top-0.5 size-3.5 bg-card text-primary" />
                    <p className="text-sm font-medium">{eventTitle(e, b.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.createdAt), "d MMM, HH:mm")} · {actor(e, access.profileId)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
