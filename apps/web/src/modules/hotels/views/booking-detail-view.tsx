import { notFound } from "next/navigation";
import { BOARD_LABEL, cancellationLabel } from "@/modules/hotels/booking-options";
import { format } from "date-fns";
import { CircleDot, LogIn, LogOut, Mail, Phone, StickyNote } from "lucide-react";
import type { HotelAccess } from "@/modules/hotels/hotel-access";
import { getBookingDetail, type BookingDetail, type BookingEvent } from "@/modules/hotels/booking-detail-queries";
import { todayIso } from "@/modules/hotels/availability";
import { getRefundQuote } from "@/modules/hotels/refund-queries";
import type { ActionState } from "@/lib/auth/actions";
import { checkInBooking, checkOutBooking } from "@/modules/hotels/front-desk-actions";
import { markBookingPaid } from "@/modules/hotels/reservation-actions";
import { PAYMENT_METHOD_LABEL, type OfflinePaymentMethod } from "@/modules/hotels/reservation-types";
import { BookingMoveActions } from "@/modules/hotels/components/booking-move-actions";
import { BookingRoomAssign } from "@/modules/hotels/components/booking-room-assign";
import { BackLink } from "@/components/back-link";
import { SubmitButton } from "@/components/submit-button";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money } from "@/lib/money";

const STATUS_OVERRIDES = { no_show: "neutral" } as const;

function stayState(b: BookingDetail, today: string) {
  if (b.status !== "pending" && b.status !== "confirmed") return null;
  if (b.checkedOutAt) return "Checked out";
  if (b.checkedInAt) return today >= b.checkOut ? "Due out" : "In house";
  if (b.status === "pending") return "Awaiting confirmation";
  return today >= b.checkIn ? "Due in" : "Upcoming";
}

function actorLabel(event: BookingEvent, viewerId: string, customerId: string | null) {
  if (!event.actorId) return "System";
  if (event.actorId === viewerId) return "You";
  return event.actorId === customerId ? "Guest" : "Staff";
}

function providerLabel(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1).replace(/_/g, " ");
}

function eventTitle(event: BookingEvent) {
  switch (event.kind) {
    case "created":
      return "Booking created";
    case "status":
      return `Marked ${(event.toValue ?? "").replace(/_/g, " ")}`;
    case "check_in":
      return "Guest checked in";
    case "check_out":
      return "Guest checked out";
    case "payment": {
      const method = event.toValue
        ? (PAYMENT_METHOD_LABEL[event.toValue as OfflinePaymentMethod] ?? providerLabel(event.toValue))
        : null;
      return method ? `Payment received · ${method}` : "Payment received";
    }
    case "refund":
      return "Refund sent";
    case "rescheduled":
      return `Dates changed · ${event.toValue ?? ""}`;
    case "room_assigned":
      return `Room ${event.toValue ?? ""} assigned`;
  }
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

export async function BookingDetailView({
  hotelId,
  bookingId,
  base,
  access,
  moveAction,
}: {
  hotelId: string;
  bookingId: string;
  base: string;
  access: HotelAccess;
  moveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {

  const booking = await getBookingDetail(hotelId, bookingId);
  if (!booking) notFound();
  const quote = booking.status === "pending" || booking.status === "confirmed" ? await getRefundQuote(booking.id) : null;

  const canManage = access.can("bookings");
  const today = todayIso();
  const state = stayState(booking, today);
  const live = booking.status === "pending" || booking.status === "confirmed";
  const leadGuest = booking.guests[0]?.fullName ?? booking.customerName ?? booking.customerEmail ?? "Guest";
  const paymentLabel = booking.paymentMethod ? PAYMENT_METHOD_LABEL[booking.paymentMethod as OfflinePaymentMethod] : null;
  const isOffline = booking.source === "offline";
  const channelLabel = booking.channel === "b2b" ? "Agency" : isOffline ? "Offline" : "Online";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <BackLink href={`${base}/bookings`} label="Bookings" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{leadGuest}</h1>
              <Badge variant={statusBadgeVariant(booking.status, STATUS_OVERRIDES)} className="capitalize">
                {booking.status.replace(/_/g, " ")}
              </Badge>
              {state ? <Badge variant="outline">{state}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {booking.reference ?? `BK-${booking.id.slice(0, 8).toUpperCase()}`} · {channelLabel} · Booked{" "}
              {format(new Date(booking.createdAt), "d MMM yyyy, HH:mm")}
            </p>
          </div>
        </div>
        {canManage ? (
          <BookingMoveActions
            bookingId={booking.id}
            status={booking.status}
            checkIn={booking.checkIn}
            today={today}
            checkedIn={booking.checkedInAt !== null}
            action={moveAction}
          />
        ) : null}
      </div>

      <StatRail className="sm:grid-cols-3 lg:grid-cols-6">
        <StatRailItem label="Check-in" value={format(new Date(`${booking.checkIn}T00:00:00`), "d MMM")} />
        <StatRailItem label="Check-out" value={format(new Date(`${booking.checkOut}T00:00:00`), "d MMM")} />
        <StatRailItem label="Nights" value={booking.nights} />
        <StatRailItem label="Rooms" value={booking.numRooms} />
        <StatRailItem
          label="Guests"
          value={booking.numChildren > 0 ? `${booking.numAdults} + ${booking.numChildren}` : booking.numAdults}
        />
        <StatRailItem label="Total" value={money(booking.totalPrice, booking.currency)} />
      </StatRail>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Room type">{booking.roomType?.name ?? "—"}</Detail>
                <Detail label="Room number">
                  {booking.assignedUnit ? (
                    `${booking.assignedUnit.roomNumber}${booking.assignedUnit.floor ? ` · Floor ${booking.assignedUnit.floor}` : ""}`
                  ) : (
                    <span className="text-muted-foreground">Not assigned</span>
                  )}
                </Detail>
              </dl>

              {canManage && live ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  {!booking.checkedInAt && booking.status === "confirmed" && booking.checkIn <= today ? (
                    <form action={checkInBooking}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <SubmitButton size="sm" pendingText="Checking in…">
                        <LogIn aria-hidden="true" /> Check in
                      </SubmitButton>
                    </form>
                  ) : null}
                  {booking.checkedInAt && !booking.checkedOutAt ? (
                    <form action={checkOutBooking}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <SubmitButton size="sm" variant="outline" pendingText="Checking out…">
                        <LogOut aria-hidden="true" /> Check out
                      </SubmitButton>
                    </form>
                  ) : null}
                  {!booking.checkedOutAt ? (
                    <BookingRoomAssign
                      bookingId={booking.id}
                      currentUnitId={booking.assignedUnit?.id ?? null}
                      units={booking.units}
                    />
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Guests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {booking.guests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No guest names</p>
              ) : (
                <ul className="divide-y divide-border">
                  {booking.guests.map((g, i) => (
                    <li key={`${g.fullName}-${i}`} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {g.fullName}
                        {i === 0 ? <Badge variant="secondary">Lead</Badge> : null}
                      </span>
                      {g.phone ? (
                        <a href={`tel:${g.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                          <Phone className="size-3.5" aria-hidden="true" /> {g.phone}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {booking.customerEmail ? (
                <a
                  href={`mailto:${booking.customerEmail}`}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Mail className="size-3.5" aria-hidden="true" /> {booking.customerEmail}
                </a>
              ) : null}
              {booking.stayDetails.booked_for_other && booking.stayDetails.lead_guest ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Staying guest:</span> {booking.stayDetails.lead_guest.name}
                  {booking.stayDetails.lead_guest.phone ? ` · ${booking.stayDetails.lead_guest.phone}` : ""}
                </p>
              ) : null}
              {booking.stayDetails.arrival_time || booking.stayDetails.purpose ? (
                <p className="text-sm text-muted-foreground">
                  {[
                    booking.stayDetails.arrival_time ? `Arrives ${booking.stayDetails.arrival_time}` : null,
                    booking.stayDetails.purpose === "business" ? "Business trip" : booking.stayDetails.purpose === "leisure" ? "Leisure trip" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              {booking.stayDetails.preferences?.some((p) => Object.keys(p).length > 0) ? (
                <ul className="space-y-1 text-sm">
                  {booking.stayDetails.preferences.map((pref, i) =>
                    Object.keys(pref).length > 0 ? (
                      <li key={i}>
                        <span className="text-muted-foreground">
                          {booking.stayDetails.preferences!.length > 1 ? `Room ${i + 1}: ` : "Preferences: "}
                        </span>
                        {Object.values(pref).join(", ")}
                      </li>
                    ) : null
                  )}
                </ul>
              ) : null}
              {booking.specialRequests ? (
                <div className="flex gap-2 rounded-lg bg-secondary/40 px-3 py-2.5 text-sm">
                  <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Special requests" />
                  <span>{booking.specialRequests}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-3">
                <Detail label="Amount">
                  <span className="tabular-nums">{money(booking.totalPrice, booking.currency)}</span>
                </Detail>
                {booking.ratePlan ? (
                  <Detail label="Rate">
                    {booking.ratePlan.name} · {BOARD_LABEL[booking.ratePlan.board]}
                    <span className="block text-xs text-muted-foreground">
                      {cancellationLabel(booking.ratePlan, booking.checkIn)}
                    </span>
                  </Detail>
                ) : null}
                {booking.extras.length > 0 ? (
                  <Detail label="Extras">
                    <ul className="space-y-0.5">
                      {booking.extras.map((extra) => (
                        <li key={extra.id} className="tabular-nums">
                          {extra.name}
                          {extra.quantity > 1 ? ` × ${extra.quantity}` : ""} · {money(extra.total, booking.currency)}
                        </li>
                      ))}
                    </ul>
                  </Detail>
                ) : null}
                <Detail label="Method">
                  {isOffline ? (paymentLabel ?? "At check-in") : (booking.onlinePayment?.methodLabel ?? "Online")}
                </Detail>
                <Detail label="Status">
                  {booking.paidAt || booking.onlinePayment ? (
                    <Badge variant="success">Paid</Badge>
                  ) : (
                    <Badge variant="warning">Unpaid</Badge>
                  )}
                </Detail>
                {quote && quote.paidAmount > 0 ? (
                  <Detail label="Refund if cancelled today">
                    <span className="tabular-nums">
                      {quote.refundAmount !== null
                        ? `${money(quote.refundAmount, booking.currency)} (${quote.deductionPercent}% deducted)`
                        : "No refund rules"}
                    </span>
                  </Detail>
                ) : null}
                {booking.paymentReference ? (
                  <Detail label="Reference">
                    <span className="font-mono text-xs">{booking.paymentReference}</span>
                  </Detail>
                ) : null}
              </dl>
              {canManage && isOffline && !booking.paidAt && live ? (
                <form action={markBookingPaid} className="mt-4 flex justify-end border-t border-border pt-4">
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="hotelId" value={hotelId} />
                  <SubmitButton size="sm" variant="outline" pendingText="Saving…">
                    Mark paid
                  </SubmitButton>
                </form>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {booking.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity</p>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {[...booking.events].reverse().map((event) => (
                  <li key={event.id} className="relative">
                    <CircleDot className="absolute top-0.5 -left-[1.6rem] size-3.5 bg-card text-primary" aria-hidden="true" />
                    <p className="text-sm font-medium">{eventTitle(event)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(event.createdAt), "d MMM, HH:mm")} · {actorLabel(event, access.profileId, booking.customerId)}
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
