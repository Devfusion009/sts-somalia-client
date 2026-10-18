import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getInvoicePdfUrl, renderProformaInvoice } from "@/modules/invoicing/actions";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  await requireUser();
  const { orderId } = await params;

  try {
    const url = await getInvoicePdfUrl(orderId);
    if (url) return NextResponse.redirect(url);
    const pdf = await renderProformaInvoice(orderId);
    return new NextResponse(new Uint8Array(pdf.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="STS-proforma-${pdf.orderNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load this invoice.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
