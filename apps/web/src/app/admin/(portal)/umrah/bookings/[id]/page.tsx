import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUmrahBookingAdmin } from "@/modules/umrah/fulfillment-admin-queries";
import { formatMoney } from "@/modules/umrah/pricing";
import {
  ORDER_STATUS_LABELS,
  UMRAH_DOC_TYPE_LABELS,
  UMRAH_STAGES,
  UMRAH_STAGE_LABELS,
  type UmrahDocType,
} from "../stages";
import { StageBadge, formatDay, formatFileSize, formatFlightTime } from "../shared";
import { DeleteDocumentButton, DocumentUploadForm, StageForm } from "./fulfillment-forms";

export const metadata: Metadata = { title: "Umrah Booking" };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Divider() {
  return (
    <span aria-hidden className="text-border">
      ·
    </span>
  );
}

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
      <dd className="text-xs text-muted-foreground">
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
  const reference = booking.order?.order_number ?? null;
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

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <BackLink href="/admin/umrah/bookings" label="All Umrah bookings" className="mb-3" />
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{reference ?? title}</h1>
            <Badge variant="secondary" className="capitalize">
              {booking.booking_kind}
            </Badge>
            <StageBadge stage={booking.fulfillment_stage} />
            {closed ? (
              <Badge className="border-transparent bg-destructive/10 text-destructive capitalize">{booking.status}</Badge>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>{title}</span>
            {dates ? (
              <>
                <Divider />
                <span>{dates}</span>
              </>
            ) : null}
            <Divider />
            <span>{booking.customer?.full_name ?? booking.customer?.email ?? "Customer"}</span>
            {booking.customer?.email && booking.customer.full_name ? (
              <>
                <Divider />
                <span>{booking.customer.email}</span>
              </>
            ) : null}
            {booking.customer?.phone ? (
              <>
                <Divider />
                <span>{booking.customer.phone}</span>
              </>
            ) : null}
            {booking.agency?.name ? (
              <>
                <Divider />
                <span>{booking.agency.name}</span>
              </>
            ) : null}
          </p>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-secondary/40 px-4 py-3 text-sm">
          <Stat label="Pilgrims" value={booking.num_pilgrims} />
          <Stat label="Total" value={formatMoney(booking.total_price, booking.currency)} />
          <Stat
            label="Payment"
            value={booking.order ? (ORDER_STATUS_LABELS[booking.order.status] ?? booking.order.status) : "No order"}
          />
          {booking.room_sharing ? <Stat label="Room sharing" value={`${booking.room_sharing} per room`} /> : null}
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-base font-semibold">Stage</h2>
              <StageBadge stage={booking.fulfillment_stage} />
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
              <p className="text-sm text-muted-foreground">No stage changes yet.</p>
            ) : (
              <ol className="divide-y divide-border">
                {booking.history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{UMRAH_STAGE_LABELS[h.stage]}</p>
                      {h.note ? <p className="text-muted-foreground">{h.note}</p> : null}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
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
        <h2 className="font-heading text-base font-semibold">Pilgrims</h2>
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Date of birth</TableHead>
                <TableHead>Nationality</TableHead>
                <TableHead>Passport</TableHead>
                <TableHead>Passport expiry</TableHead>
                <TableHead>Mahram</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {booking.pilgrims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No pilgrim details yet.
                  </TableCell>
                </TableRow>
              ) : (
                booking.pilgrims.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="capitalize">{p.gender}</TableCell>
                    <TableCell>{formatDay(p.date_of_birth)}</TableCell>
                    <TableCell>{p.nationality ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.passport_number ?? "—"}</TableCell>
                    <TableCell>{formatDay(p.passport_expiry)}</TableCell>
                    <TableCell>
                      {p.mahram_name ? `${p.mahram_name}${p.mahram_relation ? ` (${p.mahram_relation})` : ""}` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

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
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {booking.documents.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
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
                            variant="outline"
                            className="size-8"
                            aria-label={`Download ${doc.title}`}
                            nativeButton={false}
                            render={<a href={doc.url} target="_blank" rel="noopener noreferrer" />}
                          >
                            <Download className="size-3.5" />
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
