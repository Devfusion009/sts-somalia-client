import { getPaymentProofs } from "@/modules/payments/proof-actions";
import { BankTransferProof } from "@/modules/payments/components/bank-transfer-proof";
import { WaafiPaymentStatus } from "@/modules/payments/components/waafi-payment-status";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  BadgeCheck,
  BedDouble,
  CalendarClock,
  Check,
  FileText,
  Headset,
  Hourglass,
  Landmark,
  Lock,
  Plane,
  Receipt,
  X,
  type LucideIcon,
} from "lucide-react";
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
import { ManualPaymentStatus } from "@/modules/payments/components/manual-payment-status";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { money } from "@/lib/money";
import { CancelOrderButton } from "@/modules/orders/components/cancel-order-button";
import { ConvertHoldButton } from "@/modules/orders/components/convert-hold-button";
import { umrahSeatHoldEnd } from "@/modules/umrah/settings";
import { hallAwaitingQuote } from "@sts/shared-types";

export const metadata: Metadata = { title: "Checkout" };

const CHECKOUT_STEPS = ["Details", "Payment", "Confirmation"] as const;

const ITEM_ICONS: Record<string, LucideIcon> = {
  visa: FileText,
  hotel: BedDouble,
  flight: Plane,
  umrah: Landmark,
  hall: Landmark,
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const profile = await requireUser(`/checkout/${orderId}`);

  // Checkout joins order items, bookings and payments. Give that read the same
  // budget as the Umrah request detail so a slow QA/API response stays payable.
  const trpc = await getServerTrpc({ timeoutMs: 15000 });
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
  // A customer who paid on WaafiPay's page but never came back still has a
  // processing payment; re-reading its result settles it.
  const unsettledWaafi = order.payments.filter((p) => p.provider === "waafi" && ["processing", "requires_action"].includes(p.status));
  if (unsettledWaafi.length > 0) {
    await Promise.all(unsettledWaafi.map((p) => trpc.payments.confirmWaafi.mutate({ paymentId: p.id }).catch(() => null)));
    order = (await trpc.payments.orderForCheckout.query({ orderId })) as unknown as CheckoutOrderRow | null;
    if (!order) notFound();
  }
  if (!["pending_payment", "held", "partially_paid"].includes(order.status)) {
    redirect(`/checkout/${orderId}/success`);
  }
  // A booking request waiting for an admin decision is not payable yet.
  if (
    order.order_items.some(
      (item) => item.hotel_booking?.status === "waitlisted" || item.hall_booking?.status === "waitlisted" || (item.umrah_booking?.booking_kind === "private" && item.umrah_booking.status === "pending")
    )
  ) {
    redirect(`/account/bookings/${orderId}`);
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
    !umrahItem.umrah_booking.pool_request_id &&
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

  const pendingPayment = order.payments.find((p) => p.status === "requires_action" || (p.provider === "waafi" && p.status === "processing"));
  const bankProofs = pendingPayment?.provider === "manual" && pendingPayment.method_label === "Bank Transfer" ? await getPaymentProofs([pendingPayment.id]) : [];
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
  const support = (
    <>
    <section aria-labelledby="checkout-help" className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Headset className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 id="checkout-help" className="font-semibold">Need help?</h2>
        <p className="text-muted-foreground">
          <a
            href="tel:+252611444420"
            className="rounded-sm font-medium whitespace-nowrap text-foreground tabular-nums hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            +252 611 444 420
          </a>{" "}
          ·{" "}
          <WhatsAppInlineLink message={`Hello STS! I need help paying for order ${order.order_number}.`}>
            WhatsApp
          </WhatsAppInlineLink>
        </p>
      </div>
    </section>

    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Lock className="size-3.5" aria-hidden /> SSL encrypted
      </span>
      <span className="flex items-center gap-1.5">
        <BadgeCheck className="size-3.5" aria-hidden /> ISO certified
      </span>
    </div>
    </>
  );
  const holdUntil = order.hold_expires_at
    ? new Date(order.hold_expires_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Mogadishu" })
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6 flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight lg:text-3xl">Checkout</h1>
          <p className="text-sm text-muted-foreground">
            Order <span className="font-mono font-medium text-foreground">{order.order_number}</span>
          </p>
        </div>
        <ol aria-label="Checkout progress" className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          {CHECKOUT_STEPS.map((label, i) => {
            const done = i < 1;
            const current = i === 1;
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden className={`h-px w-6 sm:w-10 ${done || current ? "bg-primary" : "bg-border"}`} /> : null}
                <span
                  aria-current={current ? "step" : undefined}
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                    done ? "bg-primary text-primary-foreground" : current ? "bg-primary text-primary-foreground ring-4 ring-primary/15" : "border border-border text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span className={current ? "font-semibold" : `hidden sm:inline ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              </li>
            );
          })}
        </ol>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        {/* Summary first in reading order (phones see what they pay before how);
            lg places it in the right column. */}
        <aside aria-labelledby="order-summary-heading" className="order-2 space-y-4 lg:sticky lg:top-24 lg:order-none lg:col-start-2 lg:row-start-1">
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <h2 id="order-summary-heading" className="border-b border-border bg-muted/30 px-5 py-4 font-heading text-base font-semibold tracking-tight">
              Price details
            </h2>
              <dl className="space-y-4 px-5 py-5 text-sm tabular-nums">
                <div className={ROW}>
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{money(order.order_items.reduce((sum, item) => sum + Number(item.total_price), 0), order.currency)}</dd>
                </div>
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
                {paidTotal > 0 ? (
                  <>
                    <div className={ROW}>
                      <dt className="text-muted-foreground">Order total</dt>
                      <dd>{money(order.total, order.currency)}</dd>
                    </div>
                    <div className={ROW}>
                      <dt className="text-muted-foreground">Paid</dt>
                      <dd className="text-primary">−{money(paidTotal, order.currency)}</dd>
                    </div>
                  </>
                ) : null}
              </dl>
            <div className="border-t border-border bg-primary/5 px-5 py-5">
              <div className={ROW}>
                <span className="text-sm font-semibold">{paidTotal > 0 ? "Balance due" : "Total due"}</span>
                <span className="font-heading text-2xl font-bold tracking-tight text-primary tabular-nums">
                  <span className="mr-1 align-top text-sm font-semibold text-muted-foreground">{order.currency}</span>
                  {Number(remaining).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {order.balance_due_at && umrahItem ? (
                <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                  Balance due by {format(parseISO(order.balance_due_at), "d MMM yyyy")}
                </p>
              ) : null}
              {/* Visa refund eligibility ends when STS files the application. */}
              {order.order_items.some((item) => item.item_type === "visa") ? (
                <p className="mt-2 text-right text-xs text-muted-foreground">Visa fees are refundable before STS files the application.</p>
              ) : null}
            </div>
          </section>

          <div className="hidden space-y-4 lg:block">{support}</div>
        </aside>

        <div className="order-1 min-w-0 space-y-5 lg:order-none lg:col-start-1 lg:row-start-1">
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
              <h2 className="font-heading text-base font-semibold">Your booking</h2>
              <span className="text-xs text-muted-foreground">{order.order_items.length} {order.order_items.length === 1 ? "service" : "services"}</span>
            </div>
            <ul className="divide-y divide-border px-5">
              {order.order_items.map((item) => {
                const info = describeOrderItem(item);
                const ItemIcon = ITEM_ICONS[item.item_type] ?? Receipt;
                return (
                  <li key={item.id} className="flex items-start gap-3 py-4 text-sm">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ItemIcon className="size-[18px]" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{info.title}</p>
                      {info.subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{info.subtitle}</p> : null}
                    </div>
                    <p className="shrink-0 font-medium tabular-nums">{money(item.total_price, order.currency)}</p>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/20 px-5 py-3 text-xs">
              <span className="font-semibold">Booking contact</span>
              <span>{profile.full_name}</span><span className="break-all text-muted-foreground">{profile.email}</span>
            </div>
          </section>
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
              {pendingPayment.provider === "manual" ? <ManualPaymentStatus /> : null}
              <Alert variant="warning">
                <Hourglass />
                <AlertTitle>{pendingPayment.provider === "manual"
                  ? pendingPayment.method_label === "Pay at Office" ? "Office payment pending" : bankProofs[0]?.status === "rejected" ? "Bank transfer — correction requested" : bankProofs.length ? "Transfer proof under review" : "Bank transfer — awaiting proof"
                  : `${pendingPayment.method_label} — awaiting payment`}</AlertTitle>
                {pendingPayment.provider === "manual" ? (
                  <AlertDescription>Booking confirmation and your receipt follow staff approval of the payment.</AlertDescription>
                ) : null}
              </Alert>
              {pendingPayment.instructions ? (
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-line">{pendingPayment.instructions}</p>
              ) : null}
              {pendingPayment.provider === "manual" && pendingPayment.method_label === "Bank Transfer" ? <BankTransferProof paymentId={pendingPayment.id} proofs={bankProofs} /> : null}
              <div className="mt-4">
                {pendingPayment.provider === "waafi" ? <WaafiPaymentStatus kind="payment" referenceId={pendingPayment.id} /> : <CancelPendingPaymentButton paymentId={pendingPayment.id} />}
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
                    {umrahSeatsHeldUntil.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Mogadishu" })}
                  </AlertTitle>
                </Alert>
              ) : null}
              <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
                <CheckoutForm
                  orderId={order.id}
                  methods={methods}
                  amountLabel={money(remaining, order.currency)}
                  currency={order.currency}
                  remaining={remaining}
                  isFirstPayment={isFirstPayment}
                  minDeposit={minDeposit}
                  allowPartial={Boolean(umrahItem)}
                />
              </section>
              <div className="flex justify-start border-t border-border/70 pt-5">
                <CancelOrderButton
                  orderId={order.id}
                  redirectTo="/account/bookings"
                  label="Cancel order"
                  size="default"
                  className="min-h-11 rounded-xl border-border bg-transparent px-5 font-medium text-muted-foreground shadow-none transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive focus-visible:border-destructive/50 focus-visible:ring-destructive/15"
                />
              </div>
              <div className="space-y-4 lg:hidden">{support}</div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
