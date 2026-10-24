import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, Hourglass, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { getActiveAgencyId, HOLD_DURATION_HOURS } from "@/modules/orders/helpers";
import { describeOrderItem } from "@/modules/orders/format";
import { MIN_DEPOSIT_FRACTION } from "@/modules/payments/constants";
import { CheckoutForm, type CheckoutMethod } from "@/modules/payments/components/checkout-form";
import { CancelPendingPaymentButton } from "@/modules/payments/components/cancel-pending-payment-button";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { money } from "@/lib/money";
import { CancelOrderButton } from "@/modules/orders/components/cancel-order-button";
import { ConvertHoldButton } from "@/modules/orders/components/convert-hold-button";
import { umrahSeatHoldEnd } from "@/modules/umrah/settings";
import { hallAwaitingQuote } from "@sts/shared-types";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const profile = await requireUser();

  const trpc = await getServerTrpc();
  let order: CheckoutOrderRow | null;
  try {
    // Cast, not inferred: this procedure's output is a raw multi-branch join
    // (order_items × 5 booking kinds) — deep enough that letting TS re-derive
    // it through tRPC's own generic client machinery hits "type instantiation
    // is excessively deep" (TS2589), the same trap documented on
    // RlsSupabaseService.get() and bookings.service.ts's MyBookingsResult.
    // The service already declares the real (checked) type; this just stops
    // the client from re-walking it.
    order = (await trpc.payments.orderForCheckout.query({ orderId })) as unknown as CheckoutOrderRow | null;
  } catch {
    return <UnavailableNotice label="Checkout" />;
  }
  if (!order) notFound();
  if (!["pending_payment", "held", "partially_paid"].includes(order.status)) {
    redirect(`/checkout/${orderId}/success`);
  }

  const paidTotal = order.payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Number(order.total) - paidTotal;
  const isFirstPayment = paidTotal === 0;
  // Umrah packages may set their own deposit share; everything else is the platform-wide 50%.
  const minDeposit =
    order.min_first_payment != null
      ? Number(order.min_first_payment)
      : Math.round(Number(order.total) * MIN_DEPOSIT_FRACTION * 100) / 100;
  const umrahItem = order.order_items.find((item) => item.item_type === "umrah");
  const umrahGroupUnpaid =
    order.status === "pending_payment" &&
    paidTotal === 0 &&
    umrahItem?.umrah_booking?.booking_kind === "group" &&
    umrahItem.umrah_booking.status === "pending";
  const umrahSeatsHeldUntil = umrahGroupUnpaid ? await umrahSeatHoldEnd(order.created_at) : null;

  const awaitingQuote = order.order_items.some((item) => item.hall_booking && hallAwaitingQuote(item.hall_booking));
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
  const availableMethods = await trpc.payments.methods.query({ agencyWallet });
  const methods: CheckoutMethod[] = availableMethods.map(
    ({ id, label, description, kind, group, badges, requiresPhone, simulated }) => ({
      id,
      label,
      description,
      kind,
      group,
      badges,
      requiresPhone,
      simulated,
    })
  );

  const ROW = "flex items-baseline justify-between gap-4";
  const holdUntil = order.hold_expires_at
    ? new Date(order.hold_expires_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 lg:mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight lg:text-3xl">Payment</h1>
        <span className="font-mono text-sm text-muted-foreground">{order.order_number}</span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        {/* Summary first in reading order (phones see what they pay before how);
            lg places it in the right column. */}
        <aside aria-labelledby="order-summary-heading" className="lg:col-start-2 lg:row-start-1">
          <section className="rounded-2xl border border-border bg-card shadow-xs lg:sticky lg:top-24">
            <h2 id="order-summary-heading" className="border-b border-border px-5 py-4 font-heading text-base font-semibold">
              Order summary
            </h2>
            <ul className="divide-y divide-border px-5">
              {order.order_items.map((item) => {
                const info = describeOrderItem(item);
                return (
                  <li key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{info.title}</p>
                      {info.subtitle ? <p className="text-xs text-muted-foreground">{info.subtitle}</p> : null}
                    </div>
                    <p className="shrink-0 font-medium tabular-nums">{money(item.total_price, order.currency)}</p>
                  </li>
                );
              })}
            </ul>
            <dl className="space-y-2 border-t border-border px-5 py-4 text-sm tabular-nums">
              {Number(order.markup_amount) > 0 ? (
                <div className={ROW}>
                  <dt className="text-muted-foreground">Service fee</dt>
                  <dd>{money(order.markup_amount, order.currency)}</dd>
                </div>
              ) : null}
              {Number(order.fee_total) > 0 ? (
                <div className={ROW}>
                  <dt className="text-muted-foreground">Processing fee</dt>
                  <dd>{money(order.fee_total, order.currency)}</dd>
                </div>
              ) : null}
              <div className={`${ROW} font-semibold`}>
                <dt>Total</dt>
                <dd>{money(order.total, order.currency)}</dd>
              </div>
              {paidTotal > 0 ? (
                <div className={ROW}>
                  <dt className="text-muted-foreground">Paid so far</dt>
                  <dd>−{money(paidTotal, order.currency)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="rounded-b-2xl border-t border-border bg-secondary/40 px-5 py-4">
              <div className={ROW}>
                <span className="text-sm font-semibold">{paidTotal > 0 ? "Balance due" : "Amount due"}</span>
                <span className="font-heading text-2xl font-bold text-primary tabular-nums">
                  {money(remaining, order.currency)}
                </span>
              </div>
              {order.balance_due_at && umrahItem ? (
                <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                  Balance due by {format(parseISO(order.balance_due_at), "d MMM yyyy")}
                </p>
              ) : null}
              {umrahItem ? null : <p className="mt-2 text-xs text-muted-foreground">All fees are non-refundable.</p>}
            </div>
          </section>
        </aside>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          {holdExpired ? (
            <Alert variant="destructive">
              <X />
              <AlertTitle>This hold has expired</AlertTitle>
              <AlertDescription>
                The {HOLD_DURATION_HOURS}-hour hold closed before payment and the reservation was released.
              </AlertDescription>
            </Alert>
          ) : isHeld ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <Alert variant="warning">
                <CalendarClock />
                <AlertTitle className="tabular-nums">Held until {holdUntil ?? "—"}</AlertTitle>
                <AlertDescription>Not yet paid.</AlertDescription>
              </Alert>
              <div className="mt-4 flex flex-wrap gap-2">
                <ConvertHoldButton orderId={order.id} />
                <CancelOrderButton orderId={order.id} label="Release hold" redirectTo="/account/bookings" />
              </div>
            </section>
          ) : pendingPayment ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <Alert variant="warning">
                <Hourglass />
                <AlertTitle>{pendingPayment.method_label} — awaiting payment</AlertTitle>
              </Alert>
              {pendingPayment.instructions ? (
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-line">{pendingPayment.instructions}</p>
              ) : null}
              <div className="mt-4">
                <CancelPendingPaymentButton paymentId={pendingPayment.id} />
              </div>
            </section>
          ) : awaitingQuote ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <Alert variant="warning">
                <Hourglass />
                <AlertTitle>Awaiting the venue&apos;s price</AlertTitle>
              </Alert>
              <div className="mt-4">
                <CancelOrderButton orderId={order.id} redirectTo="/account/bookings" />
              </div>
            </section>
          ) : (
            <>
              {umrahSeatsHeldUntil ? (
                <Alert variant="warning">
                  <CalendarClock />
                  <AlertTitle className="tabular-nums">
                    Seats held until{" "}
                    {umrahSeatsHeldUntil.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </AlertTitle>
                </Alert>
              ) : null}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
                <CheckoutForm
                  orderId={order.id}
                  methods={methods}
                  amountLabel={money(remaining, order.currency)}
                  currency={order.currency}
                  remaining={remaining}
                  isFirstPayment={isFirstPayment}
                  minDeposit={minDeposit}
                />
              </section>
              <div className="flex justify-end">
                <CancelOrderButton orderId={order.id} redirectTo="/account/bookings" />
              </div>
            </>
          )}

          <section aria-labelledby="checkout-help" className="rounded-2xl bg-secondary/40 p-5 text-sm">
            <h2 id="checkout-help" className="font-semibold">
              Questions about this payment?
            </h2>
            <p className="mt-1 text-muted-foreground">
              Call{" "}
              <a
                href="tel:+252611444420"
                className="rounded-sm font-medium whitespace-nowrap text-foreground tabular-nums hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                +252 611 444 420
              </a>{" "}
              or{" "}
              <WhatsAppInlineLink message={`Hello STS! I need help paying for order ${order.order_number}.`}>
                chat on WhatsApp
              </WhatsAppInlineLink>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
