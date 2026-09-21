import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock, ArrowRight, Download } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpc } from "@/lib/trpc/server";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { describeOrderItem, hotelGuestNames } from "@/modules/orders/format";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";

export const metadata: Metadata = { title: "Payment Confirmation" };

function money(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  await requireUser();

  const trpc = await getServerTrpc();
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

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="text-center">
        {paid ? (
          <>
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="size-9 text-primary" />
            </span>
            <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight lg:text-3xl">
              Payment received — thank you!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Order <span className="font-medium text-foreground">{order.order_number}</span>{" "}
              confirmed. Receipt added to your account.
            </p>
          </>
        ) : (
          <>
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
              <Clock className="size-9 text-muted-foreground" />
            </span>
            <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight">Order {order.status}</h1>
          </>
        )}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {order.order_items.map((item) => {
            const info = describeOrderItem(item);
            const guestNames =
              item.item_type === "hotel" ? hotelGuestNames(item.hotel_booking?.guest_details) : [];
            return (
              <div key={item.id} className="flex items-start justify-between gap-4">
                <div>
                  <Link href={info.href} className="font-medium hover:underline">
                    {info.title}
                  </Link>
                  {info.subtitle ? (
                    <p className="text-xs text-muted-foreground">{info.subtitle}</p>
                  ) : null}
                  {guestNames.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Guests: {guestNames.join(", ")}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-medium">{money(item.total_price, order.currency)}</p>
              </div>
            );
          })}
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="font-medium">{successfulPayment?.method_label ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              {order.status.replace("_", " ")}
            </Badge>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total Paid</span>
            <span className="text-primary">{money(order.total, order.currency)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button size="lg" className="gap-2" render={<Link href={primaryHref} />}>
          Track your booking <ArrowRight className="size-4" />
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/account/bookings" />}>
          My Bookings
        </Button>
        {invoiceAvailable ? (
          <Button
            size="lg"
            variant="outline"
            className="gap-2"
            render={<a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />}
          >
            <Download className="size-4" /> Download Invoice
          </Button>
        ) : null}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Questions about this booking?{" "}
        <WhatsAppInlineLink message={`Hello STS! I have a question about my order ${order.order_number}.`}>
          Message us on WhatsApp
        </WhatsAppInlineLink>{" "}
        — include your order number and we&apos;ll take it from there.
      </p>
    </div>
  );
}
