import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowRight, CircleDot, Mail, Phone, StickyNote } from "lucide-react";
import { eventTypeLabel } from "@sts/shared-types";
import { todayIso } from "@/modules/hotels/availability";
import { getHallBookingDetail, type HallEvent } from "@/modules/events/hall-detail-queries";
import { markHallBookingPaid, setHallBookingStatus } from "@/modules/events/venue-manager-actions";
import { PAYMENT_METHOD_LABEL, shortTime, type OfflinePaymentMethod } from "@/modules/events/venue-desk-types";
import type { VenueAccess } from "@/modules/events/venue-access";
import { HallMoveActions } from "@/modules/events/components/hall-move-actions";
import { DeskPriceForm } from "@/modules/events/components/venue-desk-controls";
import { BookingNotesForm, RescheduleForm } from "@/modules/events/components/hall-booking-forms";
import { HallStatusBadge } from "@/modules/events/components/hall-badges";
import { venueMoney } from "@/modules/events/components/amenities";
import { SubmitButton } from "@/components/submit-button";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";

const REQUEST_KIND = { cancellation: "Cancellation", refund: "Refund", modification: "Change" } as const;

const STATUS_WORD: Record<string, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "Marked no-show",
  refunded: "Marked refunded",
  waitlisted: "Waitlisted",
  pending: "Reopened",
};

const PAYMENT_STATUS: Record<string, string> = {
  succeeded: "Paid",
  processing: "Processing",
  requires_action: "Awaiting",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Part refunded",
};

const money = venueMoney;

function day(iso: string) {
  return format(parseISO(iso), "EEE d MMM yyyy");
}

function methodLabel(value: string) {
  return PAYMENT_METHOD_LABEL[value as OfflinePaymentMethod] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function eventTitle(e: HallEvent, currency: string) {
  switch (e.kind) {
    case "created":
      return "Booking created";
    case "status":
      return STATUS_WORD[e.toValue ?? ""] ?? `Marked ${(e.toValue ?? "").replace(/_/g, " ")}`;
    case "payment":
      return e.toValue ? `Payment received · ${methodLabel(e.toValue)}` : "Payment received";
    case "refund":
      return "Refund sent";
    case "price":
      return `Price set · ${money(currency, e.toValue ?? 0)}`;
    case "rescheduled":
      return "Moved to a new date";
  }
}

function actor(e: HallEvent, viewerId: string, customerId: string | null) {
  if (!e.actorId) return "System";
  if (e.actorId === viewerId) return "You";
  return e.actorId === customerId ? "Client" : "Staff";
}

const PAYMENT_OVERRIDES = { requires_action: "warning", partially_refunded: "neutral" } as const;
const REQUEST_OVERRIDES = { withdrawn: "neutral" } as const;

/** One hall booking — shared by the admin console and the venue manager portal. */
export async function VenueBookingDetailView({
  venueId,
  bookingId,
  base,
  access,
  titleAs: Title = "h1",
}: {
  venueId: string;
  bookingId: string;
  base: string;
  access: VenueAccess;
  /** "h2" when a surrounding layout already renders the page's h1 (admin venue layout). */
  titleAs?: "h1" | "h2";
}) {
  const detail = await getHallBookingDetail(venueId, bookingId);
  if (!detail) notFound();
  const { booking: b, order, requests, events, quote } = detail;

  const today = todayIso();
  const canManage = access.can("bookings");
  const open = b.status === "pending" || b.status === "waitlisted";
  const live = open || b.status === "confirmed";
  const isOffline = b.source === "offline";
  // An online order is paid only when its payments cover the total; a deposit is part paid.
  const total = isOffline ? Number(b.price) : (order?.total ?? Number(b.price));
  const paidAmount = isOffline ? (b.paid_at ? Number(b.price) : 0) : (order?.paid ?? 0);
  const balance = Math.max(total - paidAmount, 0);
  const refunded = order?.status === "refunded";
  const priced = Number(b.price) > 0;
  const channel = b.channel === "b2b" ? (b.agency?.name ?? "Agency") : isOffline ? "Desk" : "Online";
  const from = shortTime(b.start_time);
  const to = shortTime(b.end_time);
  const dates = b.start_date === b.end_date ? day(b.start_date) : `${day(b.start_date)} – ${day(b.end_date)}`;
  const canReprice = canManage && open && !isOffline && paidAmount === 0;
  const canMove = canManage && live && b.end_date >= today;

  const paymentFact = refunded
    ? { label: "Payment", value: "Refunded", tone: undefined }
    : !priced
      ? { label: "Payment", value: "—", tone: undefined }
      : balance <= 0
        ? { label: "Payment", value: "Paid", tone: "primary" as const }
        : paidAmount > 0
          ? { label: "Balance due", value: money(b.currency, balance), tone: "warn" as const }
          : { label: "Payment", value: "Unpaid", tone: "warn" as const };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Title className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">
              {b.event_name || eventTypeLabel(b.event_type)}
            </Title>
            <HallStatusBadge status={b.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            <span className="font-mono">{b.booking_ref}</span> · {channel} · Booked {format(new Date(b.created_at), "d MMM yyyy, HH:mm")}
            {order ? (
              <>
                {" "}
                · Order <span className="font-mono">{order.number}</span>
              </>
            ) : null}
          </p>
        </div>
        {canManage ? (
          <HallMoveActions
            booking={b}
            today={today}
            isAdmin={access.isAdmin}
            paid={paidAmount > 0}
            action={setHallBookingStatus}
            fields={{ venueId }}
          />
        ) : null}
      </div>

      <StatRail className="sm:grid-cols-5">
        <StatRailItem label="Date" value={dates} />
        <StatRailItem label="Time" value={from && to ? `${from}–${to}` : from ? `From ${from}` : "All day"} />
        <StatRailItem label="Guests" value={b.expected_guests ?? "—"} />
        <StatRailItem label="Price" value={priced ? money(b.currency, total) : "Not set"} />
        <StatRailItem label={paymentFact.label} value={paymentFact.value} tone={paymentFact.tone} />
      </StatRail>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Event</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">{eventTypeLabel(b.event_type)}</dd>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{b.event_name || "—"}</dd>
                </dl>
                {b.setup_requirements ? (
                  <p className="flex gap-2 rounded-lg bg-secondary/40 px-3 py-2.5">
                    <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" role="img" aria-label="Setup" />
                    <span className="whitespace-pre-wrap">{b.setup_requirements}</span>
                  </p>
                ) : null}
                {b.customer_notes ? (
                  <p className="flex gap-2 rounded-lg bg-secondary/40 px-3 py-2.5">
                    <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" role="img" aria-label="Client notes" />
                    <span className="whitespace-pre-wrap">{b.customer_notes}</span>
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{b.contact_name ?? "Client"}</p>
                {b.agency ? <p className="text-muted-foreground">{b.agency.name}</p> : null}
                {b.contact_phone ? (
                  <a
                    href={`tel:${b.contact_phone.replace(/\s+/g, "")}`}
                    className="flex w-fit items-center gap-1.5 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Phone className="size-3.5" aria-hidden="true" /> {b.contact_phone}
                  </a>
                ) : null}
                {b.contact_email ? (
                  <a href={`mailto:${b.contact_email}`} className="flex w-fit items-center gap-1.5 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                    <Mail className="size-3.5" aria-hidden="true" /> {b.contact_email}
                  </a>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canReprice ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
                  <span className="text-sm font-medium">Quoted price</span>
                  <DeskPriceForm venueId={venueId} bookingId={b.id} price={Number(b.price)} currency={b.currency} />
                </div>
              ) : null}

              {isOffline ? (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>
                    {b.payment_method ? methodLabel(b.payment_method) : "—"}
                    {b.payment_reference ? <span className="text-muted-foreground"> · {b.payment_reference}</span> : null}
                  </span>
                  {b.paid_at ? (
                    <Badge variant="success" className="tabular-nums">
                      Paid {format(new Date(b.paid_at), "d MMM yyyy")}
                    </Badge>
                  ) : canManage && live ? (
                    <form action={markHallBookingPaid}>
                      <input type="hidden" name="bookingId" value={b.id} />
                      <input type="hidden" name="venueId" value={venueId} />
                      <SubmitButton size="sm" variant="outline" pendingText="Saving…">
                        Mark paid
                      </SubmitButton>
                    </form>
                  ) : (
                    <Badge variant="warning">Unpaid</Badge>
                  )}
                </div>
              ) : order && order.payments.length > 0 ? (
                <ul className="divide-y divide-border text-sm">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-medium">{p.method_label ?? methodLabel(p.provider)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{format(new Date(p.created_at), "d MMM yyyy, HH:mm")}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="tabular-nums">{money(b.currency, p.amount)}</p>
                        <Badge variant={statusBadgeVariant(p.status, PAYMENT_OVERRIDES)}>{PAYMENT_STATUS[p.status] ?? p.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No payments</p>
              )}

              {quote && quote.paidAmount > 0 && live ? (
                <p className="flex flex-wrap justify-between gap-x-3 border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">Refund if cancelled today</span>
                  <span className="font-medium tabular-nums">
                    {quote.refundAmount !== null
                      ? `${money(b.currency, quote.refundAmount)} (${quote.deductionPercent}% deducted)`
                      : "No refund rules set"}
                  </span>
                </p>
              ) : null}
            </CardContent>
          </Card>

          {canMove ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Change date</CardTitle>
              </CardHeader>
              <CardContent>
                <RescheduleForm
                  venueId={venueId}
                  bookingId={b.id}
                  today={today}
                  current={{ startDate: b.start_date, endDate: b.end_date, startTime: from, endTime: to }}
                />
              </CardContent>
            </Card>
          ) : null}

          {requests.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Client requests</CardTitle>
                <CardAction>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Open refunds"
                    title="Refunds"
                    render={<Link href={`${base}/refunds`} />}
                  >
                    <ArrowRight />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {requests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{REQUEST_KIND[r.kind]}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.reason}</p>
                      </div>
                      <span className="flex shrink-0 flex-col items-end gap-1 text-sm">
                        <Badge variant={statusBadgeVariant(r.status, REQUEST_OVERRIDES)} className="capitalize">
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                        {r.approved_amount !== null ? (
                          <span className="text-xs text-muted-foreground tabular-nums">{money(b.currency, r.approved_amount)}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal notes</CardTitle>
              </CardHeader>
              <CardContent>
                <BookingNotesForm venueId={venueId} bookingId={b.id} notes={b.admin_notes} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {[...events].reverse().map((e) => (
                    <li key={e.id} className="relative">
                      <CircleDot className="absolute top-0.5 -left-[1.6rem] size-3.5 bg-card text-primary" aria-hidden="true" />
                      <p className="text-sm font-medium">{eventTitle(e, b.currency)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(e.createdAt), "d MMM, HH:mm")} · {actor(e, access.profileId, b.customer_id)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
