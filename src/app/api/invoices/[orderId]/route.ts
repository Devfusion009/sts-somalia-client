import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getInvoicePdfUrl } from "@/modules/invoicing/actions";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  await requireUser();
  const { orderId } = await params;

  try {
    const url = await getInvoicePdfUrl(orderId);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load this invoice.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
