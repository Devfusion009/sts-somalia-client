import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOrderForCheckout } from "@/modules/payments/queries";
import { VoucherDocument } from "@/modules/bookings/pdf/VoucherDocument";

/**
 * Renders the travel voucher for an order on demand.
 *
 * Unlike the invoice, this is NOT cached to Storage. An issued invoice is a
 * fixed financial record, but a voucher describes the booking as it stands
 * right now — dates change, rooms get added, a leg gets cancelled — so a cached
 * copy would go stale and the customer would turn up at a hotel holding a
 * document that no longer matches the reservation.
 *
 * The order is fetched through the RLS-scoped client, so access control is the
 * same as everywhere else that reads an order.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  await requireUser();
  const { orderId } = await params;

  const order = await getOrderForCheckout(orderId);
  if (!order) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  // Vouchers are for bookings that actually exist as commitments. Handing one
  // out for an unpaid order would let a customer present a document for
  // something the supplier has never confirmed.
  if (order.status === "pending_payment" || order.status === "cancelled") {
    return NextResponse.json(
      { error: "A voucher is available once this booking is confirmed." },
      { status: 409 }
    );
  }

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", order.customer_id)
    .maybeSingle();

  const pdf = await renderToBuffer(
    <VoucherDocument
      order={order}
      customer={{ full_name: customer?.full_name ?? null, email: customer?.email ?? null }}
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
