import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock, ArrowRight, Download } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpc } from "@/lib/trpc/server";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { describeOrderItem, hotelGuestNames } from "@/modules/orders/format";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { Button } from "@/components/ui/button";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { money } from "@/lib/money";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";

export const metadata: Metadata = { title: "Payment Confirmation" };

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ order_id?: string; sid?: string; gateway?: string }>;
}) {
  const { orderId } = await params;
  const { order_id: returnedPaymentId, sid, gateway } = await searchParams;
  await requireUser(`/checkout/${orderId}/success`);

  const trpc = await getServerTrpc();
  // Back from Sifalo Pay's hosted checkout: confirm the payment with Sifalo
  // before reading the order, so the page reflects the settled state even if
  // the webhook has not arrived yet.
  if (returnedPaymentId && sid) {
    await trpc.payments.confirmSifalo.mutate({ paymentId: returnedPaymentId, sid }).catch(() => null);
  }
  // Back from WaafiPay's hosted page: same rule, the result is re-read from WaafiPay.
  if (returnedPaymentId && gateway === "waafi") {
    await trpc.payments.confirmWaafi.mutate({ paymentId: returnedPaymentId }).catch(() => null);
  }
  let order: CheckoutOrderRow | null;
  try {
    // Cast, not inferred — see the comment on the same call in
    // checkout/[orderId]/page.tsx: this procedure's output is deep enough to
    // trip TS2589 when re-walked through tRPC's client-side inference.
    order = (await trpc.payments.orderForCheckout.query({ orderId })) as unknown as CheckoutOrderRow | null;
  } catch {
    return <UnavailableNotice label="Payment Confirmation" />;
  }
  if (!order) notFound();
  if (order.status === "pending_payment") redirect(`/checkout/${orderId}`);

  const paid = order.status !== "cancelled";
  const invoiceAvailable =
    order.status === "paid" || order.status === "processing" || order.status === "completed";
  const successfulPayment = order.payments.find((p) => p.status === "succeeded");
  const primaryItem = order.order_items[0];
  const primaryHref = primaryItem ? describeOrderItem(primaryItem).href : "/account/bookings";

  const statusLabel = order.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="text-center">
        {paid ? (
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10" aria-hidden>
            <CheckCircle2 className="size-9 text-primary" />
          </span>
        ) : (
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted" aria-hidden>
            <Clock className="size-9 text-muted-foreground" />
          </span>
        )}
        <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-balance lg:text-3xl">
          {paid ? "Payment received" : `Order ${statusLabel.toLowerCase()}`}
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">{order.order_number}</p>
      </header>

      <section aria-labelledby="order-details-heading" className="mt-8 rounded-2xl border border-border bg-card shadow-xs">
        <h2 id="order-details-heading" className="border-b border-border px-5 py-4 font-heading text-base font-semibold">
          Order details
        </h2>
        <ul className="divide-y divide-border px-5">
          {order.order_items.map((item) => {
            const info = describeOrderItem(item);
            const guestNames =
              item.item_type === "hotel" ? hotelGuestNames(item.hotel_booking?.guest_details) : [];
            return (
              <li key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div className="min-w-0">
                  <Link
                    href={info.href}
                    className="rounded-sm font-medium hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {info.title}
                  </Link>
                  {info.subtitle ? <p className="text-xs text-muted-foreground">{info.subtitle}</p> : null}
                  {guestNames.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Guests: {guestNames.join(", ")}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-medium tabular-nums">{money(item.total_price, order.currency)}</p>
              </li>
            );
          })}
        </ul>
        <dl className="space-y-2.5 border-t border-border px-5 py-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Payment method</dt>
            <dd className="font-medium">{successfulPayment?.method_label ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={statusBadgeVariant(order.status)}>{statusLabel}</Badge>
            </dd>
          </div>
        </dl>
        <div className="flex items-baseline justify-between gap-4 rounded-b-2xl border-t border-border bg-secondary/40 px-5 py-4">
          <span className="text-sm font-semibold">Order total</span>
          <span className="font-heading text-2xl font-bold text-primary tabular-nums">
            {money(order.total, order.currency)}
          </span>
        </div>
      </section>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button size="lg" className="gap-2" render={<Link href={primaryHref} />}>
          Track your booking <ArrowRight className="size-4" aria-hidden />
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/account/bookings" />}>
          My bookings
        </Button>
        {invoiceAvailable ? (
          <Button
            size="lg"
            variant="outline"
            className="gap-2"
            render={<a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />}
          >
            <Download className="size-4" aria-hidden /> Download invoice
          </Button>
        ) : null}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Questions about this booking?{" "}
        <WhatsAppInlineLink message={`Hello STS! I have a question about my order ${order.order_number}.`}>
          Message us on WhatsApp
        </WhatsAppInlineLink>
      </p>
    </div>
  );
}
