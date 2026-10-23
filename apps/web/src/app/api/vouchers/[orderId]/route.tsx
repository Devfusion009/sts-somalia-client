import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { VoucherDocument } from "@/modules/bookings/pdf/VoucherDocument";
import { getBookingTravel } from "@/modules/umrah/itinerary-queries";
import { umrahVoucherAvailable } from "@/modules/umrah/voucher-gate";

/**
 * Renders the travel voucher for an order on demand.
 *
 * Unlike the invoice, this is NOT cached to Storage. An issued invoice is a
 * fixed financial record, but a voucher describes the booking as it stands
 * right now — dates change, rooms get added, a leg gets cancelled — so a cached
 * copy would go stale and the customer would turn up at a hotel holding a
 * document that no longer matches the reservation.
 *
 * The order is fetched through apps/api's RLS-scoped payments router, so
 * access control is the same as everywhere else that reads an order.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  await requireUser();
  const { orderId } = await params;

  const trpc = await getServerTrpc();
  let order: CheckoutOrderRow | null;
  try {
    // Cast, not inferred — see the comment on the same call in
    // checkout/[orderId]/page.tsx: this procedure's output is deep enough to
    // trip TS2589 when re-walked through tRPC's client-side inference.
    order = (await trpc.payments.orderForCheckout.query({ orderId })) as unknown as CheckoutOrderRow | null;
  } catch {
    return NextResponse.json({ error: "Voucher is temporarily unavailable." }, { status: 503 });
  }
  if (!order) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  // Vouchers are for bookings that actually exist as commitments: fully paid,
  // and for Umrah, flights and hotels confirmed. The same rule enables the
  // download buttons on the account and agent booking pages.
  const umrahBooking = order.order_items.find((item) => item.item_type === "umrah")?.umrah_booking ?? null;
  if (!umrahVoucherAvailable(order.status, umrahBooking ? umrahBooking.fulfillment_stage : undefined)) {
    return NextResponse.json(
      { error: "A voucher is available once this booking is paid and travel is confirmed." },
      { status: 409 }
    );
  }

  const supabase = await createClient();
  const umrahTravel = umrahBooking ? await getBookingTravel(umrahBooking.id) : null;
  const { data: customer } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", order.customer_id)
    .maybeSingle();

  const pdf = await renderToBuffer(
    <VoucherDocument
      order={order}
      customer={{ full_name: customer?.full_name ?? null, email: customer?.email ?? null }}
      umrahHotels={umrahTravel?.hotels ?? []}
    />
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="STS-voucher-${order.order_number}.pdf"`,
      // Never cached by a shared proxy — it contains the customer's itinerary.
      "Cache-Control": "private, no-store",
    },
  });
}
