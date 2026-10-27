import type { Metadata } from "next";
import { BOARD_LABEL, cancellationLabel, readExtrasSnapshot, readRatePlanSnapshot } from "@/modules/hotels/booking-options";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Send,
  Ticket,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { describeOrderItem, hotelGuestNames } from "@/modules/orders/format";
import { getServerTrpc } from "@/lib/trpc/server";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { StatusTimeline, type TimelineStage } from "@/modules/bookings/components/status-timeline";
import { BookingRequestDialog } from "@/modules/bookings/components/booking-request-dialog";
import { WithdrawRequestButton } from "@/modules/bookings/components/withdraw-request-button";
import {
  TYPE_ICON,
  TYPE_LABEL,
  StatusBadge,
  formatMoney,
} from "@/modules/bookings/components/booking-shared";
import { getRefundQuote } from "@/modules/hotels/refund-queries";
import { getHallRefundQuote } from "@/modules/events/hall-detail-queries";
import { CancelOrderButton } from "@/modules/orders/components/cancel-order-button";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { cn } from "@/lib/utils";
import { FlightDetails, hasFlightDetails } from "@/app/(marketing)/umrah/[slug]/flight-details";
import { umrahTimeline, UMRAH_STAGE_LABEL, UMRAH_DOC_TYPE_LABEL, formatFileSize } from "@/modules/umrah/timeline";
import type { BookingType } from "@/modules/bookings/types";
import { HotelStayList, ItineraryList, contactLine } from "@/modules/umrah/components/travel-details";
import { PilgrimEditor } from "@/modules/umrah/components/pilgrim-editor";
import { PilgrimDocuments } from "@/modules/umrah/components/pilgrim-documents";
import { umrahVoucherAvailable } from "@/modules/umrah/voucher-gate";
import type { PilgrimReadiness } from "@/modules/umrah/readiness";

export const metadata: Metadata = { title: "Booking Details" };

const REQUEST_KIND_LABEL: Record<string, string> = {
  cancellation: "Cancellation request",
  refund: "Refund request",
  modification: "Change request",
};

/**
 * Hotels and halls book directly when there is room and are confirmed by
 * payment. When the dates were full the booking is waitlisted until STS
 * confirms or declines it, and only then can it be paid.
 */
const HOTEL_STAGES: TimelineStage[] = [
  { key: "requested", label: "Booking placed", icon: Send },
  { key: "confirmed", label: "Booking confirmed", icon: Ticket },
  { key: "stay", label: "Your stay", icon: Landmark },
  { key: "completed", label: "Completed", icon: Users },
];

const HALL_STAGES: TimelineStage[] = [
  { key: "requested", label: "Booking placed", icon: Send },
  { key: "confirmed", label: "Booking confirmed", icon: Ticket },
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
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ requested?: string; waitlisted?: string }>;
}) {
  const [{ orderId }, submitted] = await Promise.all([params, searchParams]);
  // Set by the booking actions' redirect — this is the one render where the
  // customer has just pressed submit, so the page opens on the outcome
  // instead of the same detail view they'd see a week later.
  const justRequested = submitted.requested === "1" || submitted.waitlisted === "1";
  const justWaitlisted = submitted.waitlisted === "1";
  await requireUser();

  const trpc = await getServerTrpc();
  let order: CheckoutOrderRow | null;
  try {
    // Cast, not inferred — see the comment on the same call in
    // checkout/[orderId]/page.tsx: this procedure's output is deep enough to
    // trip TS2589 when re-walked through tRPC's client-side inference.
    order = (await trpc.payments.orderForCheckout.query({ orderId })) as unknown as CheckoutOrderRow | null;
  } catch {
    return <UnavailableNotice label="Booking Details" />;
  }
  // orderForCheckout is RLS-scoped, so a missing row means "not yours or not
  // there" — both are a 404 to the customer.
  if (!order) notFound();

  // apps/api is a separate deployment (not yet reachable from every
  // environment) — this order's own status/timeline/payment all come from
  // apps/api/Supabase directly, so a failure here degrades only the
  // modification/cancellation/refund request history rather than the whole page.
  const [requests, supabase] = await Promise.all([
    trpc.bookings.requestsForOrder.query({ orderId }).catch(() => []),
    createClient(),
  ]);

  const { data: invoice } = await supabase
    .from("invoices")
    .select("invoice_number, status")
    .eq("order_id", orderId)
    .maybeSingle();

  const { data: quoteItem } = await supabase
    .from("order_items")
    .select("hotel_booking_id, hall_booking_id")
    .eq("order_id", orderId)
    .or("hotel_booking_id.not.is.null,hall_booking_id.not.is.null")
    .limit(1)
    .maybeSingle();
  const { data: hotelTerms } = quoteItem?.hotel_booking_id
    ? await supabase
        .from("hotel_bookings")
        .select("check_in, rate_plan, extras")
        .eq("id", quoteItem.hotel_booking_id)
        .maybeSingle()
    : { data: null };
  const bookedRate = hotelTerms ? readRatePlanSnapshot(hotelTerms.rate_plan) : null;
  const bookedExtras = hotelTerms ? readExtrasSnapshot(hotelTerms.extras) : [];
  const refundQuote = quoteItem?.hotel_booking_id
    ? await getRefundQuote(quoteItem.hotel_booking_id)
    : quoteItem?.hall_booking_id
      ? await getHallRefundQuote(quoteItem.hall_booking_id)
      : null;

  const isPaid = ["paid", "processing", "completed"].includes(order.status);
  const isCancellableDirectly = order.status === "held" || order.status === "pending_payment";
  // Manual (request-first) bookings: the order stays unpaid until staff
  // confirm the booking and its final price — at which point the customer
  // pays from this page.
  const awaitingPayment = order.status === "pending_payment";
  const paidSoFar = order.payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = order.status === "partially_paid" ? Number(order.total) - paidSoFar : 0;
  const umrahItem = order.order_items.find((i) => i.item_type === "umrah");
  const umrahBooking = umrahItem?.umrah_booking ?? null;
  const voucherAvailable = umrahVoucherAvailable(order.status, umrahBooking?.fulfillment_stage);
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
  const umrahTrack = umrahBookingStatus
    ? umrahTimeline(umrahBooking?.fulfillment_stage, umrahBookingStatus)
    : null;

  // Pilgrims, history, documents (signed links), readiness and travel — one API read under the caller's access.
  const umrahFile = umrahBooking ? await (await getServerTrpc()).umrah.bookingFile.query({ bookingId: umrahBooking.id }) : null;
  const umrahPilgrims = umrahFile?.pilgrims ?? [];
  const umrahHistory = umrahFile?.history ?? [];
  const umrahDocumentRows = umrahFile?.documents ?? [];
  const umrahTravel = umrahFile?.travel ?? null;
  const umrahReadiness: Record<string, PilgrimReadiness> = umrahFile?.readiness ?? {};
  // Pilgrim details and hand-in documents stay editable until visas are filed.
  const umrahOpenForChanges =
    !!umrahBooking &&
    ["pending", "confirmed"].includes(umrahBooking.status ?? "") &&
    ["booked", "confirmed"].includes(umrahBooking.fulfillment_stage ?? "");

  const signedUrls = new Map<string, string>(
    umrahDocumentRows.filter((doc) => doc.url).map((doc) => [doc.storage_path, doc.url as string])
  );
  const pilgrimNames = new Map(umrahPilgrims.map((pilgrim) => [pilgrim.id, pilgrim.full_name]));
  const umrahDocuments = umrahDocumentRows.filter(
    (doc) => doc.source !== "customer" && signedUrls.has(doc.storage_path)
  );
  const umrahHandedIn = umrahDocumentRows
    .filter((doc) => doc.source === "customer")
    .map((doc) => ({ ...doc, url: signedUrls.get(doc.storage_path) ?? null }));
  const umrahContact = contactLine(umrahTravel?.contact ?? null);
  const umrahDeparture = umrahBooking?.departure ?? null;

  const openRequests = requests.filter((r) => r.status === "requested" || r.status === "in_review");

  const hotelItem = order.order_items.find((i) => i.item_type === "hotel");
  const hotelStatus = (hotelItem?.hotel_booking as { status?: string } | null)?.status ?? null;
  const hallItem = order.order_items.find((i) => i.item_type === "hall");
  const hallStatus = (hallItem?.hall_booking as { status?: string } | null)?.status ?? null;
  // A waitlisted booking can't be paid until STS confirms it, so the header
  // names that step instead of "pending payment".
  const waitlisted = hotelStatus === "waitlisted" || hallStatus === "waitlisted";
  const headerStatus = order.status === "pending_payment" && waitlisted ? "waitlisted" : order.status;

  // The one thing the customer has to do next, surfaced above everything
  // else: pay the booking, or settle a balance.
  const payNow =
    awaitingPayment &&
    !waitlisted &&
    (["pending", "confirmed"].includes(hotelStatus ?? "") ||
      ["pending", "confirmed"].includes(hallStatus ?? "") ||
      umrahBookingStatus === "confirmed");
  const nextStep = payNow
    ? { label: "Amount due", amount: Number(order.total), action: "Pay now" }
    : balanceDue > 0
      ? { label: "Balance due", amount: balanceDue, action: "Pay balance" }
      : null;

  const invoiceAvailable = order.status !== "cancelled";
  const showManage = requests.length > 0 || order.status !== "cancelled";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <BackLink href="/account/bookings" label="All bookings" />

      {justRequested ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/20 sm:gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-5" aria-hidden="true" />
          </span>
          <h2 className="min-w-0 flex-1 font-heading text-lg font-semibold">
            {justWaitlisted ? "You're on the waitlist" : "Booking request received"}
          </h2>
          <Button variant="outline" render={<Link href="/hotels" />}>
            Browse hotels <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <PageHeader
        title={order.order_number}
        status={<StatusBadge status={headerStatus} />}
        meta={
          <span className="tabular-nums">
            Booked {format(new Date(order.created_at), "d MMM yyyy")}
            {order.order_items.length > 1 ? ` · ${order.order_items.length} bookings` : ""}
          </span>
        }
      />

      <StatRail className={balanceDue > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"}>
        <StatRailItem label="Total" value={formatMoney(Number(order.total), order.currency)} />
        <StatRailItem label="Paid" value={formatMoney(paidSoFar, order.currency)} />
        {balanceDue > 0 ? (
          <StatRailItem label="Balance due" value={formatMoney(balanceDue, order.currency)} tone="warn" />
        ) : null}
      </StatRail>

      {nextStep ? (
        <div className="flex flex-col gap-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/25 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{nextStep.label}</p>
            <p className="font-heading text-xl font-semibold tabular-nums">
              {formatMoney(nextStep.amount, order.currency)}
            </p>
          </div>
          <Button size="lg" render={<Link href={`/checkout/${orderId}`} />}>
            <CreditCard data-icon="inline-start" aria-hidden="true" /> {nextStep.action}
          </Button>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Hotel progress (manual booking) */}
          {hotelStatus ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  Hotel booking
                  {hotelStatus === "waitlisted" ? (
                    <Badge variant="warning">Waitlisted</Badge>
                  ) : hotelStatus === "pending" && awaitingPayment ? (
                    <Badge variant="warning">Payment due</Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <StatusTimeline
                  stages={HOTEL_STAGES}
                  currentIndex={manualBookingStageIndex(hotelStatus).index}
                  outcome={manualBookingStageIndex(hotelStatus).outcome}
                />
                {bookedRate || bookedExtras.length > 0 ? (
                  <dl className="grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
                    {bookedRate ? (
                      <div>
                        <dt className="text-muted-foreground">Rate</dt>
                        <dd className="font-medium">
                          {bookedRate.name} · {BOARD_LABEL[bookedRate.board]}
                          <span
                            className={cn(
                              "block text-xs font-normal",
                              bookedRate.cancellation === "non_refundable" ? "text-muted-foreground" : "text-primary"
                            )}
                          >
                            {cancellationLabel(bookedRate, hotelTerms?.check_in)}
                          </span>
                        </dd>
                      </div>
                    ) : null}
                    {bookedExtras.length > 0 ? (
                      <div>
                        <dt className="text-muted-foreground">Extras</dt>
                        <dd className="space-y-0.5">
                          {bookedExtras.map((extra) => (
                            <span key={extra.id} className="block tabular-nums">
                              {extra.name}
                              {extra.quantity > 1 ? ` × ${extra.quantity}` : ""} · {formatMoney(extra.total, order.currency)}
                            </span>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Hall progress (manual booking) */}
          {hallStatus ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  Event booking
                  {hallStatus === "waitlisted" ? (
                    <Badge variant="warning">Waitlisted</Badge>
                  ) : hallStatus === "pending" && awaitingPayment ? (
                    <Badge variant="warning">Payment due</Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatusTimeline
                  stages={HALL_STAGES}
                  currentIndex={manualBookingStageIndex(hallStatus).index}
                  outcome={manualBookingStageIndex(hallStatus).outcome}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* Umrah progress */}
          {umrahBookingStatus && umrahTrack ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {umrahIsPrivate ? "Private Umrah" : "Umrah"}
                  {umrahIsPrivate && umrahBookingStatus === "pending" && awaitingPayment ? (
                    <Badge variant="warning">Requested</Badge>
                  ) : null}
                  {umrahBooking?.custom_request ? (
                    <span className="font-mono text-xs font-normal text-muted-foreground">
                      {umrahBooking.custom_request.reference}
                    </span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatusTimeline
                  stages={umrahTrack.stages}
                  currentIndex={umrahTrack.index}
                  outcome={umrahTrack.outcome}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* Combined itinerary */}
          <Card>
            <CardHeader>
              <CardTitle>Itinerary</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border border-t border-border">
                {order.order_items.map((item) => {
                  const described = describeOrderItem(item);
                  const type = item.item_type as BookingType;
                  const Icon = TYPE_ICON[type] ?? FileText;
                  const guests =
                    item.item_type === "hotel" ? hotelGuestNames(item.hotel_booking?.guest_details) : [];
                  const trackable = described.href !== "/account/bookings";

                  return (
                    <li key={item.id} className="flex items-start gap-3 px-4 py-3.5 sm:gap-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{described.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {[TYPE_LABEL[type] ?? item.item_type, described.subtitle].filter(Boolean).join(" · ")}
                        </p>
                        {guests.length > 0 ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">{guests.join(", ")}</p>
                        ) : null}
                      </div>
                      <span className="pt-0.5 text-sm font-medium tabular-nums">
                        {formatMoney(item.total_price, order.currency)}
                      </span>
                      {trackable ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="-my-1"
                          aria-label={`Track ${described.title}`}
                          title="Track application"
                          render={<Link href={described.href} />}
                        >
                          <ChevronRight />
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {umrahDeparture && hasFlightDetails(umrahDeparture) ? (
            <Card>
              <CardHeader>
                <CardTitle>Flights</CardTitle>
              </CardHeader>
              <CardContent>
                <FlightDetails departure={umrahDeparture} />
              </CardContent>
            </Card>
          ) : null}

          {umrahTravel?.itinerary ? (
            <Card>
              <CardHeader>
                <CardTitle>Day by day</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="border-t border-border">
                  <ItineraryList itinerary={umrahTravel.itinerary} />
                </div>
                {umrahContact ? (
                  <p className="border-t border-border px-4 pt-3 text-sm text-muted-foreground">{umrahContact}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {umrahTravel && umrahTravel.hotels.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Hotels</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="border-t border-border">
                  <HotelStayList hotels={umrahTravel.hotels} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {umrahPilgrims.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Pilgrims
                  <Badge variant="secondary">{umrahPilgrims.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="border-t border-border">
                  <PilgrimEditor pilgrims={umrahPilgrims} readiness={umrahReadiness} editable={umrahOpenForChanges} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {umrahBooking && umrahPilgrims.length > 0 && (umrahOpenForChanges || umrahHandedIn.length > 0) ? (
            <Card>
              <CardHeader>
                <CardTitle>Passports &amp; photos</CardTitle>
              </CardHeader>
              <CardContent>
                <PilgrimDocuments
                  bookingId={umrahBooking.id}
                  pilgrims={umrahPilgrims.map((p) => ({ id: p.id, full_name: p.full_name }))}
                  documents={umrahHandedIn}
                  canUpload={umrahOpenForChanges}
                />
              </CardContent>
            </Card>
          ) : null}

          {umrahHistory.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Umrah updates</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <ol className="divide-y divide-border border-t border-border">
                  {umrahHistory.map((entry) => (
                    <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
                      <time
                        dateTime={entry.created_at}
                        className="shrink-0 text-sm text-muted-foreground tabular-nums sm:w-36"
                      >
                        {format(new Date(entry.created_at), "d MMM yyyy, HH:mm")}
                      </time>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{UMRAH_STAGE_LABEL[entry.stage]}</p>
                        {entry.note ? <p className="text-sm text-muted-foreground">{entry.note}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          {/* Documents: vouchers, invoice, and anything staff have issued. */}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border border-t border-border">
                <DocumentRow
                  title="Travel voucher"
                  href={voucherAvailable ? `/api/vouchers/${orderId}` : null}
                />
                {umrahBooking ? (
                  <DocumentRow
                    title="Itinerary"
                    href={voucherAvailable ? `/api/umrah-itinerary/${orderId}` : null}
                  />
                ) : null}
                <DocumentRow
                  title={invoice ? `Invoice ${invoice.invoice_number}` : "Proforma invoice"}
                  href={invoiceAvailable ? `/api/invoices/${orderId}` : null}
                />
                {umrahDocuments.map((doc) => {
                  const pilgrimName = doc.pilgrim_id ? pilgrimNames.get(doc.pilgrim_id) : null;
                  const meta = [
                    UMRAH_DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type,
                    pilgrimName,
                    formatFileSize(doc.file_size),
                    format(new Date(doc.created_at), "d MMM yyyy"),
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <DocumentRow
                      key={doc.id}
                      title={doc.title}
                      meta={meta}
                      href={signedUrls.get(doc.storage_path) ?? null}
                    />
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Payments */}
          {order.payments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <ul className="divide-y divide-border border-t border-border">
                  {order.payments.map((payment) => (
                    <li key={payment.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium capitalize">
                          {payment.method_label ?? payment.provider}
                        </p>
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {format(new Date(payment.created_at), "d MMM yyyy, HH:mm")}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={payment.status} />
                        <span className="text-sm font-medium tabular-nums">
                          {formatMoney(payment.amount, payment.currency)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* Requests */}
          {showManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Manage booking</CardTitle>
              </CardHeader>
              {requests.length > 0 ? (
                <CardContent className="px-0">
                  <ul className="divide-y divide-border border-y border-border">
                    {requests.map((request) => (
                      <li key={request.id} className="space-y-2 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium">
                            {REQUEST_KIND_LABEL[request.kind] ?? request.kind}
                          </p>
                          <StatusBadge status={request.status} />
                        </div>
                        {request.reason ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">{request.reason}</p>
                        ) : null}
                        {request.staff_note ? (
                          <p className="text-sm">
                            <span className="font-medium">STS: </span>
                            {request.staff_note}
                          </p>
                        ) : null}
                        {request.status === "requested" || request.status === "in_review" ? (
                          <WithdrawRequestButton requestId={request.id} orderId={orderId} />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              ) : null}

              {isCancellableDirectly ? (
                <CardContent>
                  <CancelOrderButton orderId={orderId} redirectTo="/account/bookings" label="Cancel booking" size="default" />
                </CardContent>
              ) : order.status !== "cancelled" ? (
                <CardContent className="space-y-4">
                  {refundQuote && refundQuote.refundAmount !== null && refundQuote.paidAmount > 0 ? (
                    <dl className="flex items-baseline justify-between gap-3 text-sm">
                      <dt className="text-muted-foreground">Refund if cancelled today</dt>
                      <dd className="text-right font-medium tabular-nums">
                        {formatMoney(refundQuote.refundAmount, refundQuote.currency)}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {refundQuote.deductionPercent}% deducted
                        </span>
                      </dd>
                    </dl>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <BookingRequestDialog
                      orderId={orderId}
                      kind="modification"
                      currency={order.currency}
                      size="default"
                      disabled={openRequests.some((r) => r.kind === "modification")}
                    />
                    <BookingRequestDialog
                      orderId={orderId}
                      kind="cancellation"
                      currency={order.currency}
                      size="default"
                      disabled={openRequests.some((r) => r.kind === "cancellation")}
                    />
                    <BookingRequestDialog
                      orderId={orderId}
                      kind="refund"
                      currency={order.currency}
                      size="default"
                      disabled={openRequests.some((r) => r.kind === "refund")}
                    />
                  </div>
                </CardContent>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** One downloadable document; `href` null means it is not available. */
function DocumentRow({ title, meta, href }: { title: string; meta?: string; href: string | null }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", !href && "text-muted-foreground")}>{title}</p>
        {meta ? <p className="truncate text-sm text-muted-foreground">{meta}</p> : null}
      </div>
      {href ? (
        <Button
          size="icon"
          variant="outline"
          aria-label={`Download ${title}`}
          title="Download"
          render={<a href={href} target="_blank" rel="noopener noreferrer" />}
        >
          <Download />
        </Button>
      ) : (
        <Badge variant="neutral">Unavailable</Badge>
      )}
    </li>
  );
}
