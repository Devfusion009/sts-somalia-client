import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { getBookingTravel } from "@/modules/umrah/itinerary-queries";
import { ItineraryDocument } from "@/modules/umrah/pdf/ItineraryDocument";
import { umrahVoucherAvailable } from "@/modules/umrah/voucher-gate";

const FLIGHT_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function flightLine(airline: string | null, number: string | null, departsAt: string | null, arrivesAt: string | null) {
  const parts = [
    [airline, number].filter(Boolean).join(" ") || null,
    departsAt ? `departs ${FLIGHT_TIME.format(new Date(departsAt))}` : null,
    arrivesAt ? `arrives ${FLIGHT_TIME.format(new Date(arrivesAt))}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The dated Umrah itinerary as a PDF, rendered on demand like the voucher
 * (never cached: it reflects the booking as it stands now). Same access path
 * (apps/api's RLS-scoped order read) and the same paid + travel-confirmed
 * gate as the voucher.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  await requireUser();
  const { orderId } = await params;

  const trpc = await getServerTrpc();
  let order: CheckoutOrderRow | null;
  try {
    order = (await trpc.payments.orderForCheckout.query({ orderId })) as unknown as CheckoutOrderRow | null;
  } catch {
    return NextResponse.json({ error: "Itinerary is temporarily unavailable." }, { status: 503 });
  }
  if (!order) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const booking = order.order_items.find((item) => item.item_type === "umrah")?.umrah_booking ?? null;
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!umrahVoucherAvailable(order.status, booking.fulfillment_stage)) {
    return NextResponse.json(
      { error: "The itinerary is available once this booking is paid and travel is confirmed." },
      { status: 409 }
    );
  }

  const supabase = await createClient();
  const travel = await getBookingTravel(supabase, booking.id);
  if (!travel) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const departure = booking.departure;
  const pdf = await renderToBuffer(
    <ItineraryDocument
      orderNumber={order.order_number}
      title={booking.booking_kind === "private" ? (booking.custom_request?.reference ?? "Private Umrah") : (booking.package?.name ?? "Umrah")}
      pilgrims={(booking.umrah_pilgrims ?? []).map((p) => p.full_name)}
      travel={travel}
      outbound={
        departure
          ? flightLine(departure.outbound_airline, departure.outbound_flight_number, departure.outbound_departs_at, departure.outbound_arrives_at)
          : null
      }
      inbound={
        departure
          ? flightLine(departure.return_airline, departure.return_flight_number, departure.return_departs_at, departure.return_arrives_at)
          : null
      }
    />
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="STS-itinerary-${order.order_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
