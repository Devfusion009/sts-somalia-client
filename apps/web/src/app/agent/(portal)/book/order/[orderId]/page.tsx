import { UmrahIcon } from "@/components/portal/umrah-icon";
import { AgentMoney } from "@/components/portal/agent-money";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  AlertCircle,
  BedDouble,
  CheckCircle2,
  Download,
  FileText,
  PartyPopper,
  Plane,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyOrder, getAgencyTopupRequests } from "@/modules/agencies/queries";
import { describeOrderItem } from "@/modules/orders/format";
import { WalletPaymentPanel } from "@/modules/agencies/components/wallet-payment-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PayFromWalletForm } from "./pay-from-wallet-form";
import { hallAwaitingQuote } from "@sts/shared-types";

const ITEM_ICON: Record<string, LucideIcon> = {
  hotel: BedDouble,
  flight: Plane,
  visa: FileText,
  umrah: UmrahIcon,
  hall: PartyPopper,
};

export const metadata = { title: "Review & pay" };

const PAYABLE = ["pending_payment", "held", "partially_paid"];

export default async function DeskOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ topup?: string; wallet?: string }>;
}) {
  const [{ orderId }, { topup, wallet }] = await Promise.all([params, searchParams]);
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  await (await createClient()).rpc("release_public_umrah_checkouts");
  const [order, topups] = await Promise.all([
    getAgencyOrder(membership.agency.id, orderId),
    getAgencyTopupRequests(membership.agency.id),
  ]);
  if (!order) notFound();

  const canTopUp = membership.roleInAgency === "owner" || membership.roleInAgency === "admin";
  const pendingTopupTotal = topups
    .filter((request) => request.status === "pending")
    .reduce((sum, request) => sum + Number(request.amount), 0);

  const paid = order.payments
    .filter((payment) => payment.status === "succeeded")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const total = Number(order.total);
  const balance = Math.max(total - paid, 0);
  const available =
    Number(membership.agency.credit_balance ?? 0) + Number(membership.agency.credit_limit ?? 0);
  // Same rule as customer checkout: no paying an estimate the venue hasn't set.
  const awaitingConfirmation = order.order_items.some((item) => item.hall_booking && hallAwaitingQuote(item.hall_booking));
  const payable = PAYABLE.includes(order.status) && balance > 0 && !awaitingConfirmation;
  // A manual hotel seeded at "price on request" reaches here with total 0:
  // nothing is owed yet because STS hasn't quoted the rate (admin queue →
  // updateHotelBookingPrice), and rendering that as a payable USD 0 reads as
  // a free booking.
  const awaitingPrice = total === 0 && PAYABLE.includes(order.status);

  const statusLabel = awaitingPrice
    ? "Awaiting price"
    : awaitingConfirmation
      ? "Awaiting confirmation"
      : order.status.replace(/_/g, " ");
  const margin = Number(order.markup_amount ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/agent/book", label: "New booking" }}
        title={<span className="tabular-nums">{order.order_number}</span>}
        status={
          <Badge
            variant={awaitingPrice || awaitingConfirmation ? "warning" : statusBadgeVariant(order.status)}
            className="capitalize"
          >
            {statusLabel}
          </Badge>
        }
        meta={[
          order.agency_customer?.full_name,
          order.agency_customer?.phone,
          format(new Date(order.created_at), "d MMM yyyy"),
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {order.status === "paid" || order.status === "completed" ? (
              <Button
                variant="outline"
                render={<a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />}
              >
                <Download data-icon="inline-start" aria-hidden="true" /> Invoice
              </Button>
            ) : null}
            <Button variant="outline" render={<Link href="/agent/bookings" />}>
              All bookings
            </Button>
            <Button variant="outline" render={<Link href="/agent/book" />}>
              Book another service
            </Button>
          </>
        }
      />

      {wallet === "failed" && order.status !== "paid" ? (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>Wallet payment did not go through. Check the balance and pay below.</AlertDescription>
        </Alert>
      ) : null}

      {topup === "success" ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Wallet topped up.</AlertDescription>
        </Alert>
      ) : topup === "pending" ? (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>Approve the payment on your phone to finish this top-up.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold">Items</h2>
            <Badge variant="neutral" className="tabular-nums">
              {order.order_items.length}
            </Badge>
          </div>
          <Card className="overflow-hidden py-0">
            <ul className="divide-y divide-border">
              {order.order_items.map((item) => {
                const info = describeOrderItem(item);
                const Icon = ITEM_ICON[item.item_type] ?? FileText;
                return (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="min-w-0 break-words">{info.title}</span>
                        {item.item_type === "hotel" && item.hotel_booking?.status === "waitlisted" ? (
                          <Badge variant="warning">Waitlisted</Badge>
                        ) : null}
                      </p>
                      {info.subtitle ? (
                        <p className="text-xs text-muted-foreground">{info.subtitle}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-right text-sm font-medium tabular-nums">
                      {awaitingPrice ? (
                        <span className="font-normal text-muted-foreground">On request</span>
                      ) : (
                        <AgentMoney value={money(Number(item.total_price), order.currency)} />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <SummaryRow label="Net" value={<AgentMoney value={money(Number(order.subtotal), order.currency)} />} />
                <SummaryRow label="Your margin" value={<AgentMoney value={money(margin, order.currency)} />} />
                <SummaryRow
                  label="Customer pays"
                  value={awaitingPrice ? "On request" : <AgentMoney value={money(total, order.currency)} />}
                  strong
                  divided
                />
                {paid > 0 ? <SummaryRow label="Paid" value={<AgentMoney value={money(paid, order.currency)} />} /> : null}
                {!awaitingPrice ? (
                  <SummaryRow
                    label="Balance due"
                    value={<AgentMoney value={money(balance, order.currency)} />}
                    strong
                    divided={paid > 0}
                    tone={balance > 0 ? "warn" : undefined}
                  />
                ) : null}
              </dl>
            </CardContent>
          </Card>

          {payable ? (
            <WalletPaymentPanel
              due={balance}
              available={available}
              currency={order.currency}
              canTopUp={canTopUp}
              pendingTopupTotal={pendingTopupTotal}
              returnTo={`/agent/book/order/${order.id}`}
            >
              <PayFromWalletForm
                orderId={order.id}
                amount={balance}
                available={available}
                currency={order.currency}
              />
            </WalletPaymentPanel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
  divided = false,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  divided?: boolean;
  tone?: "warn";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        divided && "border-t border-border pt-2",
        strong && "font-medium"
      )}
    >
      <dt className={strong ? "text-foreground" : "text-muted-foreground"}>{label}</dt>
      <dd
        className={cn(
          "text-right tabular-nums",
          strong && "font-heading text-base font-semibold",
          tone === "warn" && "text-[color-mix(in_oklch,var(--brand-gold),black_30%)] dark:text-brand-gold"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
