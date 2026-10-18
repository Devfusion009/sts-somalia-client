import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerTrpc } from "@/lib/trpc/server";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { InvoiceDocument } from "./pdf/InvoiceDocument";

const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Returns a short-lived signed URL to this order's invoice PDF, rendering
 * and caching it in Storage on first request. The order fetch goes through
 * apps/api's RLS-scoped payments router, so access control (customer/booker/
 * agency member/admin) is enforced the same way as everywhere else that
 * reads an order — this function never widens who can see what.
 */
export async function getInvoicePdfUrl(orderId: string): Promise<string | null> {
  const supabase = await createClient();

  const trpc = await getServerTrpc();
  let order: CheckoutOrderRow | null;
  try {
    // Cast, not inferred — see the comment on the same call in
    // checkout/[orderId]/page.tsx: this procedure's output is deep enough to
    // trip TS2589 when re-walked through tRPC's client-side inference.
    order = (await trpc.payments.orderForCheckout.query({ orderId })) as unknown as CheckoutOrderRow | null;
  } catch {
    throw new Error("Invoice is temporarily unavailable. Please try again in a moment.");
  }
  if (!order) {
    throw new Error("Order not found, or you don't have access to it.");
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, issued_at, pdf_storage_path")
    .eq("order_id", orderId)
    .maybeSingle();

  // No issued invoice yet (unpaid): the route renders a proforma instead.
  if (!invoice) return null;

  const admin = createAdminClient();
  const objectPath = invoice.pdf_storage_path ?? `${orderId}/${invoice.invoice_number}.pdf`;

  if (!invoice.pdf_storage_path) {
    const [{ data: customer }, { data: agency }] = await Promise.all([
      supabase.from("profiles").select("full_name, email, phone").eq("id", order.customer_id).maybeSingle(),
      order.agency_id
        ? supabase.from("agencies").select("name").eq("id", order.agency_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const pdfBuffer = await renderToBuffer(
      <InvoiceDocument
        order={order}
        invoiceNumber={invoice.invoice_number}
        issuedAt={invoice.issued_at ?? new Date().toISOString()}
        customer={{ full_name: customer?.full_name ?? null, email: customer?.email ?? null, phone: customer?.phone ?? null }}
        agencyName={agency?.name ?? null}
      />
    );

    const { error: uploadError } = await admin.storage
      .from("invoices")
      .upload(objectPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) {
      throw new Error(`Could not generate invoice: ${uploadError.message}`);
    }

    await admin.from("invoices").update({ pdf_storage_path: objectPath }).eq("id", invoice.id);
  }

  const { data: signed, error: signError } = await admin.storage
    .from("invoices")
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) {
    throw new Error(signError?.message ?? "Could not create a download link for this invoice.");
  }

  return signed.signedUrl;
}

/**
 * Renders a proforma invoice for an order that has no issued invoice yet.
 * Never stored: the amount can still change until the order is paid.
 */
export async function renderProformaInvoice(orderId: string): Promise<{ buffer: Buffer; orderNumber: string }> {
  const supabase = await createClient();
  const trpc = await getServerTrpc();
  let order: CheckoutOrderRow | null;
  try {
    order = (await trpc.payments.orderForCheckout.query({ orderId })) as unknown as CheckoutOrderRow | null;
  } catch {
    throw new Error("Invoice is temporarily unavailable. Please try again in a moment.");
  }
  if (!order) throw new Error("Order not found, or you don't have access to it.");
  if (order.status === "cancelled") throw new Error("This order was cancelled.");

  const [{ data: customer }, { data: agency }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone").eq("id", order.customer_id).maybeSingle(),
    order.agency_id
      ? supabase.from("agencies").select("name").eq("id", order.agency_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const buffer = await renderToBuffer(
    <InvoiceDocument
      proforma
      order={order}
      invoiceNumber={`PF-${order.order_number}`}
      issuedAt={new Date().toISOString()}
      customer={{ full_name: customer?.full_name ?? null, email: customer?.email ?? null, phone: customer?.phone ?? null }}
      agencyName={agency?.name ?? null}
    />
  );
  return { buffer, orderNumber: order.order_number };
}
