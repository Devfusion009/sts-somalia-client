import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck, Headset, Hourglass } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getOrderForCheckout, describeOrderItem } from "@/modules/payments/queries";
import { getAvailablePaymentMethods } from "@/modules/payments/registry";
import { cancelPendingPayment } from "@/modules/payments/actions";
import { CheckoutForm, type CheckoutMethod } from "@/modules/payments/components/checkout-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
  await requireUser();

  const order = await getOrderForCheckout(orderId);
  if (!order) notFound();
  if (order.status !== "pending_payment") redirect(`/checkout/${orderId}/success`);

  const pendingPayment = order.payments.find((p) => p.status === "requires_action");
  const methods: CheckoutMethod[] = getAvailablePaymentMethods().map(
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
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total Fee</span>
                <span className="text-primary">{money(order.total, order.currency)}</span>
              </div>
            </CardContent>
          </Card>

          {pendingPayment ? (
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
            <CheckoutForm
              orderId={order.id}
              methods={methods}
              amountLabel={money(order.total, order.currency)}
            />
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
                  help — call +252 611 444 420.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
