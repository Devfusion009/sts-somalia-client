import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Download,
  Landmark,
  PartyPopper,
  Plane,
  Stamp,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import { getMyAgency, getAgencyOrder } from "@/modules/agencies/queries";
import { describeOrderItem, hotelGuestNames } from "@/modules/orders/format";
import { StatusTimeline } from "@/modules/bookings/components/status-timeline";
import { FlightDetails, hasFlightDetails } from "@/app/(marketing)/umrah/[slug]/flight-details";
import { umrahTimeline, UMRAH_STAGE_LABEL, UMRAH_DOC_TYPE_LABEL, formatFileSize } from "@/modules/umrah/timeline";
import { BackLink } from "@/components/back-link";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money as formatMoney } from "@/lib/money";
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

/** A manual payment waiting on STS is the one to act on. */
const PAYMENT_STATUS_VARIANT = { requires_action: "warning", partially_refunded: "neutral" } as const;

const PAYABLE = ["pending_payment", "held", "partially_paid"];

function money(amount: number, currency: string) {
  return formatMoney(amount, currency);
}

export const metadata = { title: "Booking" };

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
  // Pilgrims, history, documents (signed links), readiness and travel — one API read under the agent's access.
  const [umrahFile, openRequests] = umrahBooking
    ? await Promise.all([
        (await getServerTrpc()).umrah.bookingFile.query({ bookingId: umrahBooking.id }),
        supabase
          .from("booking_requests")
          .select("kind")
          .eq("order_id", order.id)
          .in("status", ["requested", "in_review"])
          .then(({ data }) => data ?? []),
      ])
    : [null, []];
  const umrahPilgrims = umrahFile?.pilgrims ?? [];
  const umrahHistory = umrahFile?.history ?? [];
  const umrahDocumentRows = umrahFile?.documents ?? [];
  const umrahTravel = umrahFile?.travel ?? null;
  const umrahReadiness: Record<string, PilgrimReadiness> = umrahFile?.readiness ?? {};
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

  const statusLabel = awaitingPrice ? "Awaiting price" : order.status.replace(/_/g, " ");
  const invoiceReady = order.status === "paid" || order.status === "completed";
  const balanceDueBy =
    order.balance_due_at && balance > 0 && PAYABLE.includes(order.status)
      ? format(new Date(`${order.balance_due_at}T00:00:00`), "d MMM yyyy")
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <BackLink href="/agent/bookings" label="Bookings" />
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
                {order.order_number}
              </h1>
              <Badge
                variant={awaitingPrice ? "warning" : statusBadgeVariant(order.status)}
                className="capitalize"
              >
                {statusLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {[
                order.agency_customer?.full_name,
                order.agency_customer?.phone,
                format(new Date(order.created_at), "d MMM yyyy"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {cancellable ? <CancelOrderButton orderId={order.id} redirectTo="/agent/bookings" size="default" /> : null}
            {umrahRequestable ? (
              <>
                <BookingRequestDialog
                  orderId={order.id}
                  kind="cancellation"
                  currency={order.currency}
                  size="default"
                  disabled={openRequests.some((r) => r.kind === "cancellation")}
                />
                <BookingRequestDialog
                  orderId={order.id}
                  kind="refund"
                  currency={order.currency}
                  size="default"
                  disabled={openRequests.some((r) => r.kind === "refund")}
                />
              </>
            ) : null}
            {umrahBooking ? (
              <Button
                variant="outline"
                disabled={!voucherAvailable}
                render={
                  voucherAvailable ? (
                    <a href={`/api/vouchers/${order.id}`} target="_blank" rel="noopener noreferrer" />
                  ) : undefined
                }
              >
                <Download data-icon="inline-start" aria-hidden="true" /> Voucher
              </Button>
            ) : null}
            {umrahBooking ? (
              <Button
                variant="outline"
                disabled={!voucherAvailable}
                render={
                  voucherAvailable ? (
                    <a href={`/api/umrah-itinerary/${order.id}`} target="_blank" rel="noopener noreferrer" />
                  ) : undefined
                }
              >
                <Download data-icon="inline-start" aria-hidden="true" /> Itinerary
              </Button>
            ) : null}
            {invoiceReady ? (
              <Button
                variant="outline"
                render={<a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />}
              >
                <Download data-icon="inline-start" aria-hidden="true" /> Invoice
              </Button>
            ) : null}
            {payable ? (
              <Button render={<Link href={`/agent/book/order/${order.id}`} />}>
                Pay now <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </header>
      </div>

      <StatRail className={cn(balanceDueBy && "lg:grid-cols-5")}>
        <StatRailItem label="Net" value={money(Number(order.subtotal), order.currency)} />
        <StatRailItem label="Your margin" value={money(Number(order.markup_amount ?? 0), order.currency)} />
        <StatRailItem
          label="Customer pays"
          value={awaitingPrice ? "On request" : money(total, order.currency)}
        />
        <StatRailItem
          label="Balance"
          value={awaitingPrice ? "On request" : money(balance, order.currency)}
          tone={!awaitingPrice && balance > 0 && PAYABLE.includes(order.status) ? "warn" : undefined}
        />
        {balanceDueBy ? <StatRailItem label="Balance due by" value={balanceDueBy} tone="warn" /> : null}
      </StatRail>

      <Section title="Items" count={order.order_items.length}>
        <Card className="overflow-hidden py-0">
          <ul className="divide-y divide-border">
            {order.order_items.map((item) => {
              const info = describeOrderItem(item);
              const Icon = TYPE_ICON[item.item_type];
              const guestNames =
                item.item_type === "hotel" ? hotelGuestNames(item.hotel_booking?.guest_details) : [];
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{info.title}</p>
                      {item.item_type === "hotel" && item.hotel_booking?.status === "waitlisted" ? (
                        <Badge variant="warning">Waitlisted</Badge>
                      ) : item.item_type === "hotel" && item.hotel_booking?.status === "confirmed" ? (
                        <Badge variant="success">Room confirmed</Badge>
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
                </li>
              );
            })}
          </ul>
        </Card>
      </Section>

      {umrahBooking && umrahTrack ? (
        <Section
          title="Umrah progress"
          badge={
            umrahBooking.custom_request ? (
              <span className="font-mono text-xs text-muted-foreground">
                {umrahBooking.custom_request.reference}
              </span>
            ) : null
          }
        >
          <Card>
            <CardContent>
              <StatusTimeline
                stages={umrahTrack.stages}
                currentIndex={umrahTrack.index}
                outcome={umrahTrack.outcome}
              />
            </CardContent>
          </Card>
        </Section>
      ) : null}

      {(umrahDeparture && hasFlightDetails(umrahDeparture)) || (umrahTravel && umrahTravel.hotels.length > 0) ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {umrahDeparture && hasFlightDetails(umrahDeparture) ? (
            <Section title="Flights">
              <Card>
                <CardContent>
                  <FlightDetails departure={umrahDeparture} />
                </CardContent>
              </Card>
            </Section>
          ) : null}

          {umrahTravel && umrahTravel.hotels.length > 0 ? (
            <Section title="Hotels" count={umrahTravel.hotels.length}>
              <Card className="overflow-hidden py-0">
                <CardContent className="px-0 py-0">
                  <HotelStayList hotels={umrahTravel.hotels} />
                </CardContent>
              </Card>
            </Section>
          ) : null}
        </div>
      ) : null}

      {umrahTravel?.itinerary ? (
        <Section title="Day by day">
          <Card className="overflow-hidden py-0">
            <CardContent className="px-0 py-0">
              <ItineraryList itinerary={umrahTravel.itinerary} />
              {umrahContact ? (
                <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">{umrahContact}</p>
              ) : null}
            </CardContent>
          </Card>
        </Section>
      ) : null}

      {umrahPilgrims.length > 0 ? (
        <Section title="Pilgrims" count={umrahPilgrims.length}>
          <Card className="overflow-hidden py-0">
            <CardContent className="px-0 py-0">
              <PilgrimEditor pilgrims={umrahPilgrims} readiness={umrahReadiness} editable={umrahOpenForChanges} />
            </CardContent>
          </Card>
        </Section>
      ) : null}

      {umrahBooking && umrahPilgrims.length > 0 && (umrahOpenForChanges || umrahHandedIn.length > 0) ? (
        <Section title="Passports and photos">
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
        </Section>
      ) : null}

      {umrahDocuments.length > 0 || umrahHistory.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {umrahDocuments.length > 0 ? (
            <Section title="Travel documents" count={umrahDocuments.length}>
              <Card className="overflow-hidden py-0">
                <ul className="divide-y divide-border">
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
                      <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">{meta}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Download ${doc.title}`}
                          title="Download"
                          render={
                            <a
                              href={signedUrls.get(doc.storage_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          <Download aria-hidden="true" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </Section>
          ) : null}

          {umrahHistory.length > 0 ? (
            <Section title="Umrah updates" count={umrahHistory.length}>
              <Card className="overflow-hidden py-0">
                <ol className="divide-y divide-border">
                  {umrahHistory.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
                      <span className="w-32 shrink-0 text-xs text-muted-foreground tabular-nums">
                        {format(new Date(entry.created_at), "d MMM yyyy, HH:mm")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{UMRAH_STAGE_LABEL[entry.stage]}</p>
                        {entry.note ? <p className="text-sm text-muted-foreground">{entry.note}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </Section>
          ) : null}
        </div>
      ) : null}

      <Section title="Payments" count={order.payments.length}>
        <Card className="overflow-hidden py-0">
          {order.payments.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <CreditCard />
              </EmptyMedia>
              <EmptyTitle>No payments</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(payment.created_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">{payment.method_label ?? payment.provider}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {payment.provider_ref ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadgeVariant(payment.status, PAYMENT_STATUS_VARIANT)}
                        className="capitalize"
                      >
                        {payment.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell numeric className="text-sm font-medium">
                      {money(Number(payment.amount), payment.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  badge,
  children,
}: {
  title: string;
  count?: number;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {count ? (
          <Badge variant="neutral" className="tabular-nums">
            {count}
          </Badge>
        ) : null}
        {badge}
      </div>
      {children}
    </section>
  );
}
