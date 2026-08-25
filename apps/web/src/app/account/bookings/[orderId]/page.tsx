import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Plane,
  ReceiptText,
  Send,
  Ticket,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOrderForCheckout, describeOrderItem, hotelGuestNames } from "@/modules/payments/queries";
import { getServerTrpc } from "@/lib/trpc/server";
import { StatusTimeline, type TimelineStage } from "@/modules/bookings/components/status-timeline";
import { BookingRequestDialog } from "@/modules/bookings/components/booking-request-dialog";
import { WithdrawRequestButton } from "@/modules/bookings/components/withdraw-request-button";
import {
  TYPE_ICON,
  TYPE_LABEL,
  StatusBadge,
  formatMoney,
} from "@/modules/bookings/components/booking-shared";
import { CancelOrderButton } from "@/modules/orders/components/cancel-order-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import type { BookingType } from "@/modules/bookings/types";

export const metadata: Metadata = { title: "Booking Details" };

/**
 * Umrah progresses through operational stages that mirror what actually happens
 * to a pilgrim's file: the booking is taken, the seat is confirmed against a
 * departure, the visa is issued, and the group travels.
 */
const UMRAH_STAGES: TimelineStage[] = [
  { key: "booked", label: "Booking received", icon: Send },
  { key: "confirmed", label: "Seats confirmed", icon: Users },
  { key: "visa", label: "Visa & documents", icon: FileText },
  { key: "travel", label: "Departure", icon: Plane },
  { key: "completed", label: "Completed", icon: Landmark },
];

function umrahStageIndex(status: string): { index: number; outcome: "pending" | "success" | "failed" } {
  switch (status) {
    case "pending":
      return { index: 0, outcome: "pending" };
    case "confirmed":
      return { index: 1, outcome: "pending" };
    case "completed":
      return { index: 4, outcome: "success" };
    case "cancelled":
    case "refunded":
    case "no_show":
    case "failed":
      // Parked at the final marker with a failed outcome rather than reset to
      // zero — the booking did progress, it just ended badly, and showing it at
      // stage one would misrepresent the history.
      return { index: 4, outcome: "failed" };
    default:
      return { index: 0, outcome: "pending" };
  }
}

const REQUEST_KIND_LABEL: Record<string, string> = {
  cancellation: "Cancellation request",
  refund: "Refund request",
  modification: "Change request",
};

/**
 * Hotels and halls are manual bookings (no supplier APIs in Somalia): a
 * request goes into the staff queue and a human confirms it. These tracks
 * show the customer exactly where their request is — including the
 * waitlisted case, where the dates were full and the request is parked
 * until a slot frees up.
 */
const HOTEL_STAGES: TimelineStage[] = [
  { key: "requested", label: "Request received", description: "Waiting in the booking queue", icon: Send },
  { key: "confirmed", label: "Booking confirmed", description: "Room allocated by the hotel", icon: Ticket },
  { key: "stay", label: "Your stay", icon: Landmark },
  { key: "completed", label: "Completed", icon: Users },
];

const HALL_STAGES: TimelineStage[] = [
  { key: "requested", label: "Request received", description: "Waiting in the booking queue", icon: Send },
  { key: "confirmed", label: "Booking confirmed", description: "Venue reserved for your event", icon: Ticket },
  { key: "event", label: "Event day", icon: Landmark },
  { key: "completed", label: "Completed", icon: Users },
];

function manualBookingStageIndex(status: string): { index: number; outcome: "pending" | "success" | "failed" } {
  switch (status) {
    case "pending":
    case "waitlisted":
      return { index: 0, outcome: "pending" };
    case "confirmed":
      return { index: 1, outcome: "pending" };
    case "completed":
      return { index: 3, outcome: "success" };
    case "cancelled":
    case "refunded":
    case "no_show":
    case "failed":
      return { index: 3, outcome: "failed" };
    default:
      return { index: 0, outcome: "pending" };
  }
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const profile = await requireUser();

  const order = await getOrderForCheckout(orderId);
  // getOrderForCheckout is RLS-scoped, so a missing row means "not yours or not
  // there" — both are a 404 to the customer.
  if (!order) notFound();

  const trpc = await getServerTrpc();
  // apps/api is a separate deployment (not yet reachable from every
  // environment) — this order's own status/timeline/payment all come from
  // Supabase directly, so a failure here degrades only the modification/
  // cancellation/refund request history rather than the whole page.
  const [requests, supabase] = await Promise.all([
    trpc.bookings.requestsForOrder.query({ orderId }).catch(() => []),
    createClient(),
  ]);

  const { data: invoice } = await supabase
    .from("invoices")
    .select("invoice_number, status")
    .eq("order_id", orderId)
    .maybeSingle();

  const isPaid = ["paid", "processing", "completed"].includes(order.status);
  const isCancellableDirectly = order.status === "held" || order.status === "pending_payment";
  // Manual (request-first) bookings: the order stays unpaid until staff
  // confirm the booking and its final price — at which point the customer
  // pays from this page.
  const awaitingPayment = order.status === "pending_payment";
  const voucherAvailable = isPaid;

  const umrahItem = order.order_items.find((i) => i.item_type === "umrah");
  const umrahBooking = umrahItem?.umrah_booking as
    | { status?: string; booking_kind?: string; custom_request?: { reference: string } | null }
    | null;
  // The booking's own status now comes back on the checkout query, and for a
  // private trip it is the ONLY accurate source: that booking sits at
  // 'pending' until staff confirm availability, which is exactly the state
  // the customer needs to see. Group bookings keep the old order-derived
  // reading as a fallback for rows written before booking_kind existed.
  const umrahBookingStatus = umrahBooking
    ? (umrahBooking.status ??
      (order.status === "completed"
        ? "completed"
        : order.status === "cancelled"
          ? "cancelled"
          : isPaid
            ? "confirmed"
            : "pending"))
    : null;
  const umrahIsPrivate = umrahBooking?.booking_kind === "private";

  const openRequests = requests.filter((r) => r.status === "requested" || r.status === "in_review");

  const hotelItem = order.order_items.find((i) => i.item_type === "hotel");
  const hotelStatus = (hotelItem?.hotel_booking as { status?: string } | null)?.status ?? null;
  const hallItem = order.order_items.find((i) => i.item_type === "hall");
  const hallStatus = (hallItem?.hall_booking as { status?: string } | null)?.status ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 gap-1.5 text-muted-foreground"
          render={<Link href="/account/bookings" />}
        >
          <ArrowLeft className="size-4" /> All bookings
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold">{order.order_number}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Booked {format(new Date(order.created_at), "d MMMM yyyy")}
              {order.order_items.length > 1
                ? ` · ${order.order_items.length} bookings in this itinerary`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
            <span className="font-heading text-xl font-bold">
              {formatMoney(order.total, order.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="size-4 text-muted-foreground" /> Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!voucherAvailable}
            render={
              voucherAvailable ? (
                <a href={`/api/vouchers/${orderId}`} target="_blank" rel="noopener noreferrer" />
              ) : undefined
            }
          >
            <Download className="size-3.5" /> Travel voucher
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!invoice}
            render={
              invoice ? (
                <a href={`/api/invoices/${orderId}`} target="_blank" rel="noopener noreferrer" />
              ) : undefined
            }
          >
            <ReceiptText className="size-3.5" /> Invoice
            {invoice ? ` ${invoice.invoice_number}` : ""}
          </Button>
          {!voucherAvailable ? (
            <p className="w-full text-xs text-muted-foreground">
              Your voucher becomes available once this booking is paid and confirmed.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Combined itinerary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Itinerary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <ul className="divide-y divide-border border-t border-border">
            {order.order_items.map((item) => {
              const described = describeOrderItem(item);
              const type = item.item_type as BookingType;
              const Icon = TYPE_ICON[type] ?? FileText;
              const guests =
                item.item_type === "hotel" ? hotelGuestNames(item.hotel_booking?.guest_details) : [];

              return (
                <li key={item.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Badge variant="secondary" className="mb-1">
                      {TYPE_LABEL[type] ?? item.item_type}
                    </Badge>
                    <p className="font-medium">{described.title}</p>
                    {described.subtitle ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{described.subtitle}</p>
                    ) : null}
                    {guests.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Guests: {guests.join(", ")}
                      </p>
                    ) : null}
                    {described.href !== "/account/bookings" ? (
                      <Link
                        href={described.href}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Track this application <ArrowRight className="size-3" />
                      </Link>
                    ) : null}
                  </div>
                  <span className="font-medium tabular-nums">
                    {formatMoney(item.total_price, order.currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Hotel progress (manual booking) */}
      {hotelStatus ? (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              Hotel booking progress
              {hotelStatus === "waitlisted" ? (
                <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">Waitlisted</Badge>
              ) : hotelStatus === "pending" && awaitingPayment ? (
                <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">Requested</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hotelStatus === "waitlisted" ? (
              <Alert>
                <AlertDescription>
                  Your dates are currently full, so your request is in the queue. Our team will confirm
                  as soon as a room frees up — you won&apos;t be charged until then.
                </AlertDescription>
              </Alert>
            ) : hotelStatus === "pending" && awaitingPayment ? (
              <Alert>
                <AlertDescription>
                  Your request is with our team — we&apos;re checking with the hotel and will confirm
                  your booking and final price. You won&apos;t pay anything until it&apos;s confirmed.
                </AlertDescription>
              </Alert>
            ) : null}
            <StatusTimeline
              stages={HOTEL_STAGES}
              currentIndex={manualBookingStageIndex(hotelStatus).index}
              outcome={manualBookingStageIndex(hotelStatus).outcome}
            />
            <PayAfterConfirmation show={hotelStatus === "confirmed" && awaitingPayment} orderId={orderId} total={order.total} currency={order.currency} />
          </CardContent>
        </Card>
      ) : null}

      {/* Hall progress (manual booking) */}
      {hallStatus ? (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              Event booking progress
              {hallStatus === "pending" && awaitingPayment ? (
                <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">Requested</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hallStatus === "pending" && awaitingPayment ? (
              <Alert>
                <AlertDescription>
                  Your request is with the venue — they confirm availability and your final price
                  (based on your guest count) before the booking is completed. You won&apos;t pay
                  anything until then.
                </AlertDescription>
              </Alert>
            ) : null}
            <StatusTimeline
              stages={HALL_STAGES}
              currentIndex={manualBookingStageIndex(hallStatus).index}
              outcome={manualBookingStageIndex(hallStatus).outcome}
            />
            <PayAfterConfirmation show={hallStatus === "confirmed" && awaitingPayment} orderId={orderId} total={order.total} currency={order.currency} />
          </CardContent>
        </Card>
      ) : null}

      {/* Umrah progress */}
      {umrahBookingStatus ? (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {umrahIsPrivate ? "Private Umrah progress" : "Umrah progress"}
              {umrahIsPrivate && umrahBookingStatus === "pending" && awaitingPayment ? (
                <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">
                  Requested
                </Badge>
              ) : null}
              {umrahBooking?.custom_request ? (
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {umrahBooking.custom_request.reference}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {umrahIsPrivate && umrahBookingStatus === "pending" && awaitingPayment ? (
              <Alert>
                <AlertDescription>
                  Your trip is with our Umrah team — we&apos;re confirming your hotels, seats and
                  visa slots for these dates. You won&apos;t pay anything until it&apos;s confirmed,
                  and the price you agreed is what you&apos;ll be charged unless we tell you first.
                </AlertDescription>
              </Alert>
            ) : null}
            <StatusTimeline
              stages={UMRAH_STAGES}
              currentIndex={umrahStageIndex(umrahBookingStatus).index}
              outcome={umrahStageIndex(umrahBookingStatus).outcome}
            />
            <PayAfterConfirmation
              show={umrahBookingStatus === "confirmed" && awaitingPayment}
              orderId={orderId}
              total={order.total}
              currency={order.currency}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Payments */}
      {order.payments.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4 text-muted-foreground" /> Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-0">
            <ul className="divide-y divide-border border-t border-border">
              {order.payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{payment.provider}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.created_at), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  <StatusBadge status={payment.status} />
                  <span className="text-sm font-medium tabular-nums">
                    {formatMoney(payment.amount, payment.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Manage this booking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.length > 0 ? (
            <ul className="space-y-2">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {REQUEST_KIND_LABEL[request.kind] ?? request.kind}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {request.reason}
                    </p>
                    {request.staff_note ? (
                      <p className="mt-1 text-xs">
                        <span className="font-medium">STS: </span>
                        {request.staff_note}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={request.status} />
                  {request.status === "requested" || request.status === "in_review" ? (
                    <WithdrawRequestButton requestId={request.id} orderId={orderId} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {requests.length > 0 ? <Separator /> : null}

          {isCancellableDirectly ? (
            <CancelOrderButton orderId={orderId} redirectTo="/account/bookings" />
          ) : order.status === "cancelled" ? (
            <Alert>
              <AlertDescription>This booking has been cancelled.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This booking is paid, so changes go through our team — supplier fare rules decide
                what&apos;s possible and what it costs. We&apos;ll confirm before anything changes.
              </p>
              <div className="flex flex-wrap gap-2">
                <BookingRequestDialog
                  orderId={orderId}
                  kind="modification"
                  currency={order.currency}
                  disabled={openRequests.some((r) => r.kind === "modification")}
                />
                <BookingRequestDialog
                  orderId={orderId}
                  kind="cancellation"
                  currency={order.currency}
                  disabled={openRequests.some((r) => r.kind === "cancellation")}
                />
                <BookingRequestDialog
                  orderId={orderId}
                  kind="refund"
                  currency={order.currency}
                  disabled={openRequests.some((r) => r.kind === "refund")}
                />
              </div>
              {openRequests.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Options you already have an open request for are disabled until that request is
                  resolved or withdrawn.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Booked by {profile.full_name ?? profile.email} · Reference {order.order_number}
      </p>
    </div>
  );
}

/**
 * The moment a manual (request-first) booking is confirmed, its confirmed
 * final price becomes payable — this is the customer's path into checkout,
 * which never existed at request time.
 */
function PayAfterConfirmation({
  show,
  orderId,
  total,
  currency,
}: {
  show: boolean;
  orderId: string;
  total: number | string;
  currency: string;
}) {
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div>
        <p className="text-sm font-medium">Your booking is confirmed — complete payment to lock it in.</p>
        <p className="text-xs text-muted-foreground">
          Final confirmed price: {formatMoney(Number(total), currency)}
        </p>
      </div>
      <Button className="gap-1.5" render={<Link href={`/checkout/${orderId}`} />}>
        <CreditCard className="size-4" /> Complete payment
      </Button>
    </div>
  );
}
