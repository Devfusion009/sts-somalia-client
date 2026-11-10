import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { getUmrahBookingAdmin } from "@/modules/umrah/fulfillment-admin-queries";
import { formatMoney } from "@/modules/umrah/pricing";
import { PriceAdjustment } from "@/modules/umrah/components/price-adjustment";
import {
  ORDER_STATUS_LABELS,
  UMRAH_DOC_TYPE_LABELS,
  UMRAH_STAGES,
  UMRAH_STAGE_LABELS,
  type UmrahDocType,
} from "../stages";
import { StageBadge, formatDay, formatFileSize, formatFlightTime } from "../shared";
import {
  CancelBookingButton,
  DeleteDocumentButton,
  DeleteSegmentButton,
  DocumentUploadForm,
  ReviewDocumentButtons,
  SegmentDialog,
  StageForm,
} from "./fulfillment-forms";
import { RecordPaymentDialog } from "../../../orders/record-payment-dialog";
import { PilgrimEditor } from "@/modules/umrah/components/pilgrim-editor";
import { HotelStayList, ItineraryList, contactLine } from "@/modules/umrah/components/travel-details";
import { CITY_LABEL } from "@/modules/umrah/itinerary";
import { HAND_IN_LABEL, REVIEW_STATUS_LABEL, type HandInType } from "@/modules/umrah/readiness";

export const metadata: Metadata = { title: "Umrah Booking" };

const REVIEW_VARIANT = { accepted: "success", rejected: "destructive", pending: "warning" } as const;

function FlightLeg({
  label,
  airline,
  flightNumber,
  departsAt,
  arrivesAt,
}: {
  label: string;
  airline: string | null;
  flightNumber: string | null;
  departsAt: string | null;
  arrivesAt: string | null;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">
        {[airline, flightNumber].filter(Boolean).join(" ") || "—"}
      </dd>
      <dd className="text-xs text-muted-foreground tabular-nums">
        {formatFlightTime(departsAt)} → {formatFlightTime(arrivesAt)}
      </dd>
    </div>
  );
}

export default async function AdminUmrahBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getUmrahBookingAdmin(id);
  if (!booking) notFound();

  const isGroup = booking.booking_kind === "group";
  const title = isGroup ? (booking.package?.name ?? "Group Umrah") : (booking.custom_request?.reference ?? "Private Umrah");
  const order = booking.order;
  const reference = order?.order_number ?? null;
  const travel = booking.travel;
  const itinerary = travel?.itinerary ?? null;
  const contact = contactLine(travel?.contact ?? null);
  const currentIndex = UMRAH_STAGES.indexOf(booking.fulfillment_stage);
  const nextStages = UMRAH_STAGES.slice(currentIndex + 1);
  const closed = ["cancelled", "refunded", "failed"].includes(booking.status);
  const departure = booking.departure;
  const hasFlights =
    !!departure &&
    [
      departure.outbound_airline,
      departure.outbound_flight_number,
      departure.outbound_departs_at,
      departure.return_airline,
      departure.return_flight_number,
      departure.return_departs_at,
      departure.baggage_note,
    ].some(Boolean);
  const pilgrimName = new Map(booking.pilgrims.map((p) => [p.id, p.full_name]));

  const dates = isGroup
    ? departure
      ? `${formatDay(departure.departure_date)} – ${formatDay(departure.return_date)}`
      : null
    : booking.custom_request?.departure_date
      ? `${formatDay(booking.custom_request.departure_date)} · ${booking.custom_request.nights_makkah} nights Makkah / ${booking.custom_request.nights_madinah} nights Madinah`
      : null;

  const meta = [
    reference ? title : null,
    dates,
    booking.order?.guest
      ? `${booking.order.guest.full_name} · booked by ${booking.booker?.full_name ?? booking.customer?.full_name ?? "agent"}`
      : (booking.customer?.full_name ?? booking.customer?.email ?? "Customer"),
    booking.customer?.email && booking.customer.full_name ? booking.customer.email : null,
    booking.customer?.phone ?? null,
    booking.agency?.name ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <BackLink href="/admin/umrah/bookings" label="All Umrah bookings" />
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{reference ?? title}</h1>
              <Badge variant="neutral" className="capitalize">
                {booking.booking_kind}
              </Badge>
              <StageBadge stage={booking.fulfillment_stage} />
              {closed ? (
                <Badge variant={statusBadgeVariant(booking.status)} className="capitalize">
                  {booking.status}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">{meta}</p>
          </div>
          {order && order.balance > 0 && ["pending_payment", "held", "partially_paid"].includes(order.status) ? (
            <div className="flex shrink-0 items-center gap-2">
              <RecordPaymentDialog orderId={order.id} remaining={order.balance} currency={order.currency} />
            </div>
          ) : null}
        </header>

        <StatRail className="lg:grid-cols-6">
          <StatRailItem label="Pilgrims" value={booking.num_pilgrims} />
          <StatRailItem label="Total" value={formatMoney(order?.total ?? booking.total_price, booking.currency)} />
          <StatRailItem label="Paid" value={order ? formatMoney(order.paid, order.currency) : "—"} />
          <StatRailItem
            label="Balance"
            value={order ? formatMoney(order.balance, order.currency) : "—"}
            sub={order?.balance_due_at && order.balance > 0 ? `Due ${formatDay(order.balance_due_at)}` : undefined}
            tone={order && order.balance > 0 ? "warn" : undefined}
          />
          <StatRailItem label="Payment" value={order ? (ORDER_STATUS_LABELS[order.status] ?? order.status) : "No order"} />
          <StatRailItem label="Room sharing" value={booking.room_sharing ? `${booking.room_sharing} per room` : "—"} />
        </StatRail>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-base font-semibold">Stage</h2>
              <div className="flex items-center gap-2">
                {!closed && booking.status !== "completed" && booking.fulfillment_stage !== "completed" ? (
                  <CancelBookingButton bookingId={booking.id} paid={order?.paid ?? 0} currency={booking.currency} />
                ) : null}
              </div>
            </div>
            {nextStages.length > 0 && !closed ? (
              <StageForm bookingId={booking.id} nextStages={nextStages} />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-heading text-base font-semibold">Stage history</h2>
            {booking.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stage changes</p>
            ) : (
              <ol className="divide-y divide-border">
                {booking.history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{UMRAH_STAGE_LABELS[h.stage]}</p>
                      {h.note ? <p className="text-muted-foreground">{h.note}</p> : null}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {h.actor?.full_name ?? h.actor?.email ?? "System"} ·{" "}
                      {new Date(h.created_at).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {isGroup && hasFlights && departure ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Flights</h2>
          <Card>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-3">
                <FlightLeg
                  label="Outbound"
                  airline={departure.outbound_airline}
                  flightNumber={departure.outbound_flight_number}
                  departsAt={departure.outbound_departs_at}
                  arrivesAt={departure.outbound_arrives_at}
                />
                <FlightLeg
                  label="Return"
                  airline={departure.return_airline}
                  flightNumber={departure.return_flight_number}
                  departsAt={departure.return_departs_at}
                  arrivesAt={departure.return_arrives_at}
                />
                <div>
                  <dt className="text-xs text-muted-foreground">Baggage</dt>
                  <dd className="text-sm font-medium">{departure.baggage_note ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold">Travel details</h2>
          <SegmentDialog bookingId={booking.id} />
        </div>
        {travel && travel.segments.length > 0 ? (
          <Card className="gap-0 overflow-hidden py-0">
            <ul className="divide-y divide-border">
              {travel.segments.map((segment) => (
                <li key={segment.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Badge variant="neutral" className="capitalize">
                    {segment.kind}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{segment.title}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {[
                        segment.provider,
                        segment.reference,
                        segment.city ? (CITY_LABEL[segment.city] ?? segment.city) : null,
                        segment.starts_at ? formatFlightTime(segment.starts_at) : null,
                        segment.ends_at ? `to ${formatFlightTime(segment.ends_at)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <SegmentDialog bookingId={booking.id} segment={segment} />
                  <DeleteSegmentButton segmentId={segment.id} title={segment.title} />
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="py-0">
            <p className="px-5 py-6 text-sm text-muted-foreground">No travel segments</p>
          </Card>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">{isGroup ? "Hotels" : "Services"}</h2>
          <Card className="overflow-hidden py-0">
            {isGroup ? (
              travel && travel.hotels.length > 0 ? (
                <HotelStayList hotels={travel.hotels} />
              ) : (
                <p className="px-5 py-6 text-sm text-muted-foreground">No hotels on this package</p>
              )
            ) : booking.serviceLines.length > 0 ? (
              <ul className="divide-y divide-border">
                {booking.serviceLines.map((line) => (
                  <li key={line.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{line.name}</span>
                      <span className="text-muted-foreground"> · {line.quantity} × {formatMoney(Number(line.unit_price), booking.currency)}</span>
                    </span>
                    <span className="tabular-nums">{formatMoney(Number(line.line_total), booking.currency)}</span>
                  </li>
                ))}
                <PriceAdjustment total={Number(booking.total_price)} lines={booking.serviceLines} currency={booking.currency} className="px-5 py-3" />
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">No services</p>
            )}
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold">Day by day</h2>
            {itinerary?.warnings.includes("nights_mismatch") ? (
              <Badge variant="warning">Hotel nights do not match the dates</Badge>
            ) : null}
            {itinerary?.warnings.includes("days_mismatch") ? (
              <Badge variant="warning">Day plan does not match the duration</Badge>
            ) : null}
          </div>
          <Card className="overflow-hidden py-0">
            {itinerary ? (
              <ItineraryList itinerary={itinerary} />
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">No departure date</p>
            )}
            {contact ? <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">{contact}</p> : null}
          </Card>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Pilgrims</h2>
        <Card className="overflow-hidden py-0">
          {booking.pilgrims.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No pilgrim details</p>
          ) : (
            <PilgrimEditor pilgrims={booking.pilgrims} readiness={booking.readiness} editable variant="table" />
          )}
        </Card>
      </section>

      {booking.handedIn.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Passports and photos</h2>
          <Card className="overflow-hidden py-0">
            <ul className="divide-y divide-border">
              {booking.handedIn.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {HAND_IN_LABEL[doc.doc_type as HandInType] ?? doc.doc_type}
                      {doc.pilgrim_id ? ` · ${pilgrimName.get(doc.pilgrim_id) ?? "Pilgrim"}` : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      {[doc.file_size ? formatFileSize(doc.file_size) : null, new Date(doc.created_at).toLocaleDateString(), doc.review_note]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Badge variant={REVIEW_VARIANT[doc.review_status as keyof typeof REVIEW_VARIANT] ?? "warning"}>
                    {REVIEW_STATUS_LABEL[doc.review_status] ?? doc.review_status}
                  </Badge>
                  {doc.url ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Download ${doc.title}`}
                      nativeButton={false}
                      render={<a href={doc.url} target="_blank" rel="noopener noreferrer" />}
                    >
                      <Download />
                    </Button>
                  ) : null}
                  {doc.review_status === "pending" ? <ReviewDocumentButtons documentId={doc.id} /> : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Documents</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent>
              <DocumentUploadForm
                bookingId={booking.id}
                pilgrims={booking.pilgrims.map((p) => ({ id: p.id, full_name: p.full_name }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              {booking.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents</p>
              ) : (
                <ul className="divide-y divide-border">
                  {booking.documents.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.title}</p>
                        <p className="truncate text-xs text-muted-foreground tabular-nums">
                          {UMRAH_DOC_TYPE_LABELS[doc.doc_type as UmrahDocType] ?? doc.doc_type}
                          {doc.pilgrim_id ? ` · ${pilgrimName.get(doc.pilgrim_id) ?? "Pilgrim"}` : ""}
                          {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""} ·{" "}
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {doc.url ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Download ${doc.title}`}
                            nativeButton={false}
                            render={<a href={doc.url} target="_blank" rel="noopener noreferrer" />}
                          >
                            <Download />
                          </Button>
                        ) : null}
                        <DeleteDocumentButton documentId={doc.id} title={doc.title} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
