import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck, Headset, Hourglass, CalendarClock, X } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveAgencyId, HOLD_DURATION_HOURS } from "@/modules/orders/helpers";
import { convertHoldToCheckout, cancelOrder } from "@/modules/orders/actions";
import { getOrderForCheckout, describeOrderItem } from "@/modules/payments/queries";
import { getAvailablePaymentMethods } from "@/modules/payments/registry";
import { cancelPendingPayment } from "@/modules/payments/actions";
import { CheckoutForm, type CheckoutMethod } from "@/modules/payments/components/checkout-form";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CancelOrderButton } from "@/modules/orders/components/cancel-order-button";

export const metadata: Metadata = { title: "Checkout" };

function money(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const profile = await requireUser();

  const order = await getOrderForCheckout(orderId);
  if (!order) notFound();
  if (order.status !== "pending_payment" && order.status !== "held") {
    redirect(`/checkout/${orderId}/success`);
  }

  const isHeld = order.status === "held";
  const holdExpired = isHeld && order.hold_expires_at != null && new Date(order.hold_expires_at) < new Date();

  // Lazy expiry: the viewer already has access to this specific order, so
  // cancel it under their own permissions the moment anyone loads a stale
  // hold — no privileged sweep needed on this path.
  if (holdExpired) {
    const supabase = await createClient();
    await supabase.rpc("cancel_order", { target_order_id: orderId, reason: "Hold expired" });
  }

  // B2B: members of the booking agency can settle from the agency wallet.
  let agencyWallet: { available: number; currency: string } | undefined;
  if (order.agency_id) {
    const supabase = await createClient();
    const memberAgencyId = await getActiveAgencyId(supabase, profile.id);
    if (memberAgencyId === order.agency_id) {
      const { data: agency } = await supabase
        .from("agencies")
        .select("credit_balance, credit_limit")
        .eq("id", order.agency_id)
        .maybeSingle();
      if (agency) {
        agencyWallet = {
          available: Number(agency.credit_balance) + Number(agency.credit_limit),
          currency: order.currency,
        };
      }
    }
  }

  const pendingPayment = order.payments.find((p) => p.status === "requires_action");
  const methods: CheckoutMethod[] = getAvailablePaymentMethods({ agencyWallet }).map(
    ({ id, label, description, kind, badges, requiresPhone, simulated }) => ({
      id,
      label,
      description,
      kind,
      badges,
      requiresPhone,
      simulated,
    })
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Payment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order <span className="font-medium text-foreground">{order.order_number}</span> — please
          select your preferred payment method and complete your payment.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" />
            All payments are secure and encrypted. We do not store your card details.
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {order.order_items.map((item) => {
                const info = describeOrderItem(item);
                return (
                  <div key={item.id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{info.title}</p>
                      {info.subtitle ? (
                        <p className="text-xs text-muted-foreground">{info.subtitle}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 font-medium">
                      {money(item.total_price, order.currency)}
                    </p>
                  </div>
                );
              })}
              {Number(order.markup_amount) > 0 ? (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Service fee</span>
                  <span>{money(order.markup_amount, order.currency)}</span>
                </div>
              ) : null}
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total Fee</span>
                <span className="text-primary">{money(order.total, order.currency)}</span>
              </div>
            </CardContent>
          </Card>

          {holdExpired ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <X className="size-4 text-destructive" />
                <CardTitle className="text-base">This hold has expired</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="leading-relaxed">
                  The {HOLD_DURATION_HOURS}-hour hold window closed before payment was completed —
                  the reservation and any held inventory have been released. Search again to book a
                  new one.
                </p>
              </CardContent>
            </Card>
          ) : isHeld ? (
            <Card className="border-brand-gold/50 bg-brand-gold/5">
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <CalendarClock className="size-4 text-brand-gold" />
                <CardTitle className="text-base">Held — not yet paid</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="leading-relaxed">
                  This booking is reserved until{" "}
                  <span className="font-medium text-foreground">
                    {order.hold_expires_at
                      ? new Date(order.hold_expires_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </span>
                  . Pay now to confirm it, or cancel to release the hold.
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={convertHoldToCheckout}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <Button type="submit" size="sm" className="gap-1.5">
                      Pay Now
                    </Button>
                  </form>
                  <CancelOrderButton orderId={order.id} label="Release Hold" redirectTo="/account/bookings" />
                </div>
              </CardContent>
            </Card>
          ) : pendingPayment ? (
            <Card className="border-brand-gold/50 bg-brand-gold/5">
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <Hourglass className="size-4 text-brand-gold" />
                <CardTitle className="text-base">
                  {pendingPayment.method_label} — awaiting payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="leading-relaxed">{pendingPayment.instructions}</p>
                <p className="text-xs text-muted-foreground">
                  Our team confirms the payment as soon as it arrives — you&apos;ll see the status
                  update in your account automatically.
                </p>
                <form action={cancelPendingPayment}>
                  <input type="hidden" name="paymentId" value={pendingPayment.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Choose a different method
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <CheckoutForm
                orderId={order.id}
                methods={methods}
                amountLabel={money(order.total, order.currency)}
              />
              <div className="flex justify-end">
                <CancelOrderButton orderId={order.id} redirectTo="/account/bookings" />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Number</span>
                <span className="font-medium">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium">{order.order_items.length}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <span>Total Fee</span>
                <span className="text-primary">{money(order.total, order.currency)}</span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">All fees are non-refundable.</p>
            </CardContent>
          </Card>

          <Card className="bg-secondary/60">
            <CardContent className="flex gap-3 pt-6 text-sm">
              <Headset className="size-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Need Help?</p>
                <p className="mt-1 text-muted-foreground">
                  If you have any questions about the payment process, our support team is here to
                  help — call +252 611 444 420 or{" "}
                  <WhatsAppInlineLink
                    message={`Hello STS! I need help paying for order ${order.order_number}.`}
                  >
                    chat with us on WhatsApp
                  </WhatsAppInlineLink>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
