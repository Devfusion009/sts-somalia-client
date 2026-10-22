import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  Building2,
  Download,
  Landmark,
  PartyPopper,
  Plane,
  Stamp,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency, getAgencyOrder } from "@/modules/agencies/queries";
import { describeOrderItem, hotelGuestNames } from "@/modules/orders/format";
import { StatusTimeline } from "@/modules/bookings/components/status-timeline";
import { FlightDetails, hasFlightDetails } from "@/app/(marketing)/umrah/[slug]/flight-details";
import { umrahTimeline, UMRAH_STAGE_LABEL, UMRAH_DOC_TYPE_LABEL, formatFileSize } from "@/modules/umrah/timeline";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CancelOrderButton } from "@/modules/orders/components/cancel-order-button";
import { BookingRequestDialog } from "@/modules/bookings/components/booking-request-dialog";
import { getBookingTravel } from "@/modules/umrah/itinerary-queries";
import { HotelStayList, ItineraryList, contactLine } from "@/modules/umrah/components/travel-details";
import { PilgrimEditor } from "@/modules/umrah/components/pilgrim-editor";
import { PilgrimDocuments } from "@/modules/umrah/components/pilgrim-documents";
import { umrahVoucherAvailable } from "@/modules/umrah/voucher-gate";
import type { PilgrimReadiness } from "@/modules/umrah/readiness";

const TYPE_ICON = {
  hotel: Building2,
  flight: Plane,
  visa: Stamp,
  umrah: Landmark,
  hall: PartyPopper,
} as const;

const ORDER_STATUS_STYLES: Record<string, string> = {
  held: "bg-brand-gold/15 text-brand-gold",
  pending_payment: "bg-brand-gold/15 text-brand-gold",
  paid: "bg-primary/10 text-primary",
  processing: "bg-chart-3/10 text-chart-3",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/10 text-destructive",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-primary/10 text-primary",
  processing: "bg-chart-3/10 text-chart-3",
  requires_action: "bg-brand-gold/15 text-brand-gold",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
  partially_refunded: "bg-destructive/10 text-destructive",
};

const PAYABLE = ["pending_payment", "held", "partially_paid"];

function money(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(0)}`;
}

export default async function AgentBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { id } = await params;
  const order = await getAgencyOrder(membership.agency.id, id);
  if (!order) notFound();

  const paidTotal = order.payments
    .filter((payment) => payment.status === "succeeded")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const total = Number(order.total);
  const balance = Math.max(total - paidTotal, 0);
  // Manual hotels seeded "price on request" sit at total 0 until STS quotes
  // them from the admin queue — showing a computed balance reads as free.
  const awaitingPrice = total === 0 && PAYABLE.includes(order.status);
  const payable = PAYABLE.includes(order.status) && balance > 0 && !awaitingPrice;
  const cancellable = order.status === "pending_payment" || order.status === "held" || awaitingPrice;
  const umrahItem = order.order_items.find((item) => item.item_type === "umrah");
  const umrahBooking = umrahItem?.umrah_booking ?? null;
  const voucherAvailable = umrahVoucherAvailable(order.status, umrahBooking?.fulfillment_stage);
  const canBook = ["owner", "admin", "booking_staff"].includes(membership.roleInAgency);
  const umrahTrack = umrahBooking ? umrahTimeline(umrahBooking.fulfillment_stage, umrahBooking.status) : null;
  const umrahDeparture = umrahBooking?.departure ?? null;

  const supabase = await createClient();
  const [umrahPilgrims, umrahHistory, umrahDocumentRows, umrahReadinessRows, umrahTravel, openRequests] = umrahBooking
    ? await Promise.all([
        supabase
          .from("umrah_pilgrims")
          .select(
            "id, full_name, gender, date_of_birth, nationality, passport_number, passport_expiry, passport_issue_country, mahram_name, mahram_relation, phone"
          )
          .eq("booking_id", umrahBooking.id)
          .order("full_name")
          .then(({ data }) => data ?? []),
        supabase
          .from("umrah_booking_stage_history")
          .select("id, stage, note, created_at")
          .eq("booking_id", umrahBooking.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => data ?? []),
        supabase
          .from("umrah_booking_documents")
          .select("id, pilgrim_id, doc_type, title, storage_path, file_name, file_size, created_at, source, review_status, review_note")
          .eq("booking_id", umrahBooking.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => data ?? []),
        supabase
          .rpc("umrah_pilgrim_readiness", { p_booking_id: umrahBooking.id })
          .then(({ data }) => data ?? []),
        getBookingTravel(supabase, umrahBooking.id),
        supabase
          .from("booking_requests")
          .select("kind")
          .eq("order_id", order.id)
          .in("status", ["requested", "in_review"])
          .then(({ data }) => data ?? []),
      ])
    : [[], [], [], [], null, []];
  const umrahReadiness: Record<string, PilgrimReadiness> = Object.fromEntries(
    umrahReadinessRows.map((r) => [r.pilgrim_id, { missing: r.missing, warnings: r.warnings }])
  );
  const umrahOpenForChanges =
    canBook &&
    !!umrahBooking &&
    ["pending", "confirmed"].includes(umrahBooking.status) &&
    ["booked", "confirmed"].includes(umrahBooking.fulfillment_stage);
  // A paid Umrah booking is cancelled through a request STS approves, which
  // ends the booking and releases its seats.
  const umrahRequestable =
    canBook && !!umrahBooking && ["paid", "partially_paid", "processing"].includes(order.status) &&
    ["pending", "confirmed"].includes(umrahBooking.status);

  // Private bucket: links are signed per render and expire after an hour.
  const signedUrls = new Map<string, string>();
  if (umrahDocumentRows.length > 0) {
    const { data: signed } = await supabase.storage
      .from("umrah-documents")
      .createSignedUrls(
        umrahDocumentRows.map((doc) => doc.storage_path),
        60 * 60
      );
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) signedUrls.set(entry.path, entry.signedUrl);
    }
  }
  const pilgrimNames = new Map(umrahPilgrims.map((pilgrim) => [pilgrim.id, pilgrim.full_name]));
  const umrahDocuments = umrahDocumentRows.filter(
    (doc) => doc.source !== "customer" && signedUrls.has(doc.storage_path)
  );
  const umrahHandedIn = umrahDocumentRows
    .filter((doc) => doc.source === "customer")
    .map((doc) => ({ ...doc, url: signedUrls.get(doc.storage_path) ?? null }));
  const umrahContact = contactLine(umrahTravel?.contact ?? null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackLink href="/agent/bookings" label="Bookings" className="mb-3" />
          <h1 className="font-heading text-2xl font-bold">{order.order_number}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[
              order.agency_customer?.full_name,
              order.agency_customer?.phone,
              format(new Date(order.created_at), "d MMM yyyy"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Badge
          className={cn(
            "border-transparent capitalize",
            ORDER_STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"
          )}
        >
          {awaitingPrice ? "Awaiting price" : order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-secondary/40 px-4 py-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Net</dt>
          <dd className="font-medium tabular-nums">{money(Number(order.subtotal), order.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Your margin</dt>
          <dd className="font-medium tabular-nums">
            {money(Number(order.markup_amount ?? 0), order.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Customer pays</dt>
          <dd className="font-semibold tabular-nums">
            {awaitingPrice ? "On request" : money(total, order.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Balance</dt>
          <dd className="font-semibold tabular-nums">
            {awaitingPrice ? "On request" : money(balance, order.currency)}
          </dd>
        </div>
        {order.balance_due_at && balance > 0 && PAYABLE.includes(order.status) ? (
          <div>
            <dt className="text-xs text-muted-foreground">Balance due by</dt>
            <dd className="font-medium tabular-nums">{format(new Date(`${order.balance_due_at}T00:00:00`), "d MMM yyyy")}</dd>
          </div>
        ) : null}
      </dl>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Items</h2>
        <Card className="overflow-hidden py-0">
          <CardContent className="divide-y divide-border px-4 py-0">
            {order.order_items.map((item) => {
              const info = describeOrderItem(item);
              const Icon = TYPE_ICON[item.item_type];
              const guestNames =
                item.item_type === "hotel" ? hotelGuestNames(item.hotel_booking?.guest_details) : [];
              return (
                <div key={item.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{info.title}</p>
                      {item.item_type === "hotel" && item.hotel_booking?.status === "waitlisted" ? (
                        <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">
                          Waitlisted
                        </Badge>
                      ) : item.item_type === "hotel" && item.hotel_booking?.status === "confirmed" ? (
                        <Badge className="border-transparent bg-primary/10 text-primary">
                          Room confirmed
                        </Badge>
                      ) : null}
                    </div>
                    {info.subtitle ? (
                      <p className="text-xs text-muted-foreground">{info.subtitle}</p>
                    ) : null}
                    {guestNames.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Guests: {guestNames.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right text-sm tabular-nums">
                    <p className="font-medium">{money(Number(item.total_price), order.currency)}</p>
                    {item.quantity > 1 ? (
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {money(Number(item.unit_price), order.currency)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {umrahBooking && umrahTrack ? (
        <section className="space-y-3">
          <h2 className="flex flex-wrap items-center gap-2 font-heading text-base font-semibold">
            Umrah progress
            {umrahBooking.custom_request ? (
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {umrahBooking.custom_request.reference}
              </span>
            ) : null}
          </h2>
          <Card>
            <CardContent>
              <StatusTimeline
                stages={umrahTrack.stages}
                currentIndex={umrahTrack.index}
                outcome={umrahTrack.outcome}
              />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {umrahDeparture && hasFlightDetails(umrahDeparture) ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Flights</h2>
          <Card>
            <CardContent>
              <FlightDetails departure={umrahDeparture} />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {umrahTravel?.itinerary ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Day by day</h2>
          <Card className="overflow-hidden py-0">
            <CardContent className="px-0 py-0">
              <ItineraryList itinerary={umrahTravel.itinerary} />
              {umrahContact ? (
                <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">{umrahContact}</p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {umrahTravel && umrahTravel.hotels.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Hotels</h2>
          <Card className="overflow-hidden py-0">
            <CardContent className="px-0 py-0">
              <HotelStayList hotels={umrahTravel.hotels} />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {umrahPilgrims.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Pilgrims</h2>
          <Card className="overflow-hidden py-0">
            <CardContent className="px-0 py-0">
              <PilgrimEditor pilgrims={umrahPilgrims} readiness={umrahReadiness} editable={umrahOpenForChanges} />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {umrahBooking && umrahPilgrims.length > 0 && (umrahOpenForChanges || umrahHandedIn.length > 0) ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Passports and photos</h2>
          <Card>
            <CardContent>
              <PilgrimDocuments
                bookingId={umrahBooking.id}
                pilgrims={umrahPilgrims.map((p) => ({ id: p.id, full_name: p.full_name }))}
                documents={umrahHandedIn}
                canUpload={umrahOpenForChanges}
              />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {umrahDocuments.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Travel documents</h2>
          <Card className="overflow-hidden py-0">
            <CardContent className="divide-y divide-border px-4 py-0">
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
                  <div key={doc.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">{meta}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Download ${doc.title}`}
                      render={
                        <a
                          href={signedUrls.get(doc.storage_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <Download className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {umrahHistory.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Umrah updates</h2>
          <Card className="overflow-hidden py-0">
            <CardContent className="divide-y divide-border px-4 py-0">
              {umrahHistory.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
                  <span className="w-36 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {format(new Date(entry.created_at), "d MMM yyyy, HH:mm")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{UMRAH_STAGE_LABEL[entry.stage]}</p>
                    {entry.note ? <p className="text-sm text-muted-foreground">{entry.note}</p> : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Payments</h2>
        {order.payments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No payments recorded yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(payment.created_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.method_label ?? payment.provider}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {payment.provider_ref ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {money(Number(payment.amount), payment.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border-transparent capitalize",
                            PAYMENT_STATUS_STYLES[payment.status] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {payment.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {payable ? (
          <Button className="gap-1.5" render={<Link href={`/agent/book/order/${order.id}`} />}>
            Pay now <ArrowRight className="size-3.5" />
          </Button>
        ) : null}
        {umrahBooking ? (
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={!voucherAvailable}
            render={
              voucherAvailable ? (
                <a href={`/api/vouchers/${order.id}`} target="_blank" rel="noopener noreferrer" />
              ) : undefined
            }
          >
            <Download className="size-3.5" /> Travel voucher
          </Button>
        ) : null}
        {umrahBooking ? (
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={!voucherAvailable}
            render={
              voucherAvailable ? (
                <a href={`/api/umrah-itinerary/${order.id}`} target="_blank" rel="noopener noreferrer" />
              ) : undefined
            }
          >
            <Download className="size-3.5" /> Itinerary
          </Button>
        ) : null}
        {umrahRequestable ? (
          <>
            <BookingRequestDialog
              orderId={order.id}
              kind="cancellation"
              currency={order.currency}
              disabled={openRequests.some((r) => r.kind === "cancellation")}
            />
            <BookingRequestDialog
              orderId={order.id}
              kind="refund"
              currency={order.currency}
              disabled={openRequests.some((r) => r.kind === "refund")}
            />
          </>
        ) : null}
        {order.status === "paid" || order.status === "completed" ? (
          <Button
            variant="outline"
            className="gap-1.5"
            render={<a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />}
          >
            <Download className="size-3.5" /> Invoice
          </Button>
        ) : null}
        {cancellable ? (
          <CancelOrderButton orderId={order.id} redirectTo="/agent/bookings" />
        ) : null}
      </div>
    </div>
  );
}
