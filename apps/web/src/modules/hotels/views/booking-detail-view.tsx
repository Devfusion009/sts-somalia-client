import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  BedDouble,
  Check,
  CircleDot,
  CreditCard,
  LogIn,
  LogOut,
  Mail,
  Phone,
  StickyNote,
  Users,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "bg-brand-gold/15 text-brand-gold",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
  no_show: "bg-muted text-muted-foreground",
};

function stayState(b: BookingDetail, today: string) {
  if (b.status !== "pending" && b.status !== "confirmed") return null;
  if (b.checkedOutAt) return "Checked out";
  if (b.checkedInAt) return today >= b.checkOut ? "Due out" : "In house";
  if (b.status === "pending") return "Awaiting confirmation";
  return today >= b.checkIn ? "Due in" : "Upcoming";
}

function actorLabel(event: BookingEvent, viewerId: string) {
  if (!event.actorId) return "System";
  return event.actorId === viewerId ? "You" : "Staff";
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

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-secondary/40 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg font-semibold">{value}</dd>
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
  const leadGuest = booking.guests[0]?.fullName ?? "Guest";
  const paymentLabel = booking.paymentMethod ? PAYMENT_METHOD_LABEL[booking.paymentMethod as OfflinePaymentMethod] : null;
  const isOffline = booking.source === "offline";
  const channelLabel = booking.channel === "b2b" ? "Agency" : isOffline ? "Offline" : "Online";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackLink href={`${base}/bookings`} label="Bookings" />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-heading text-2xl font-semibold">{leadGuest}</h1>
              <Badge className={cn("border-transparent capitalize", STATUS_BADGE[booking.status] ?? "bg-muted text-muted-foreground")}>
                {booking.status.replace(/_/g, " ")}
              </Badge>
              {state ? <Badge variant="outline">{state}</Badge> : null}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
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

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="Check-in" value={format(new Date(`${booking.checkIn}T00:00:00`), "d MMM")} />
        <Fact label="Check-out" value={format(new Date(`${booking.checkOut}T00:00:00`), "d MMM")} />
        <Fact label="Nights" value={booking.nights} />
        <Fact label="Rooms" value={booking.numRooms} />
        <Fact
          label="Guests"
          value={booking.numChildren > 0 ? `${booking.numAdults} + ${booking.numChildren}` : booking.numAdults}
        />
        <Fact label="Total" value={`${booking.currency} ${booking.totalPrice.toFixed(0)}`} />
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BedDouble className="size-4 text-primary" /> Room
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2">
                <div className="bg-card px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Room type</dt>
                  <dd className="font-medium">{booking.roomType?.name ?? "—"}</dd>
                </div>
                <div className="bg-card px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Room number</dt>
                  <dd className="font-medium">
                    {booking.assignedUnit
                      ? `${booking.assignedUnit.roomNumber}${booking.assignedUnit.floor ? ` · Floor ${booking.assignedUnit.floor}` : ""}`
                      : "Not assigned"}
                  </dd>
                </div>
              </dl>

              {canManage && live ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  {!booking.checkedInAt && booking.status === "confirmed" && booking.checkIn <= today ? (
                    <form action={checkInBooking}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <SubmitButton size="sm" className="gap-1.5" pendingText="Checking in…">
                        <LogIn className="size-3.5" /> Check in
                      </SubmitButton>
                    </form>
                  ) : null}
                  {booking.checkedInAt && !booking.checkedOutAt ? (
                    <form action={checkOutBooking}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <SubmitButton size="sm" variant="outline" className="gap-1.5" pendingText="Checking out…">
                        <LogOut className="size-3.5" /> Check out
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
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" /> Guests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {booking.guests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No guest names recorded.</p>
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
                          <Phone className="size-3.5" /> {g.phone}
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
                  <Mail className="size-3.5" /> {booking.customerEmail}
                </a>
              ) : null}
              {booking.specialRequests ? (
                <div className="flex gap-2 rounded-lg bg-secondary/40 px-3 py-2.5 text-sm">
                  <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{booking.specialRequests}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-primary" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-3">
                <div className="bg-card px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Amount</dt>
                  <dd className="font-medium">
                    {booking.currency} {booking.totalPrice.toFixed(2)}
                  </dd>
                </div>
                <div className="bg-card px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Method</dt>
                  <dd className="font-medium">
                    {isOffline ? (paymentLabel ?? "At check-in") : (booking.onlinePayment?.methodLabel ?? "Online")}
                  </dd>
                </div>
                <div className="bg-card px-3 py-2.5">
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="flex items-center gap-2 font-medium">
                    {booking.paidAt || booking.onlinePayment ? (
                      <span className="flex items-center gap-1 text-primary">
                        <Check className="size-4" /> Paid
                      </span>
                    ) : (
                      <span className="text-brand-gold">Unpaid</span>
                    )}
                  </dd>
                </div>
              </dl>
              {quote && quote.paidAmount > 0 ? (
                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">Refund if cancelled today </span>
                  <span className="font-medium">
                    {quote.refundAmount !== null
                      ? `${booking.currency} ${quote.refundAmount.toFixed(2)} (${quote.deductionPercent}% deducted)`
                      : "No refund rules set"}
                  </span>
                </p>
              ) : null}
              {booking.paymentReference ? (
                <p className="mt-3 text-sm text-muted-foreground">Reference {booking.paymentReference}</p>
              ) : null}
              {canManage && isOffline && !booking.paidAt && live ? (
                <form action={markBookingPaid} className="mt-4">
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
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {[...booking.events].reverse().map((event) => (
                  <li key={event.id} className="relative">
                    <CircleDot className="absolute -left-[1.6rem] top-0.5 size-3.5 bg-card text-primary" />
                    <p className="text-sm font-medium">{eventTitle(event)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.createdAt), "d MMM, HH:mm")} · {actorLabel(event, access.profileId)}
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
