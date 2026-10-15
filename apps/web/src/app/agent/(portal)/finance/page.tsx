import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight, Banknote, CreditCard, PiggyBank, Plus, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyAgency,
  getAgencyWallet,
  getAgencyEarningsSummary,
  getAgencyCommissionPayouts,
  getAgencyPayoutRequests,
  getAgencyTopupRequests,
} from "@/modules/agencies/queries";
import { getTopupOptions } from "@/modules/payments/topup";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EarningsPipeline } from "./earnings-pipeline";

export const metadata: Metadata = { title: "Finance" };

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

const REQUEST_STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  approved: "bg-primary/10 text-primary",
  paid: "bg-chart-3/10 text-chart-3",
  rejected: "bg-destructive/10 text-destructive",
};

export default async function AgentFinancePage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const [wallet, earnings, payouts, requests, topups] = await Promise.all([
    getAgencyWallet(membership.agency.id),
    getAgencyEarningsSummary(membership.agency.id),
    getAgencyCommissionPayouts(membership.agency.id),
    getAgencyPayoutRequests(membership.agency.id),
    getAgencyTopupRequests(membership.agency.id),
  ]);
  const options = await getTopupOptions();
  const pendingTopups = topups.filter((t) => t.status === "pending");

  const lastPayout = payouts[0] ?? null;
  const openRequest = requests.find((r) => r.status === "pending" || r.status === "approved") ?? null;

  const walletCards = [
    {
      label: "Wallet balance",
      value: `${wallet.balance < 0 ? "−" : ""}${money(Math.abs(wallet.balance))}`,
      sub: wallet.balance < 0 ? "Owed to STS" : undefined,
      icon: Wallet,
      tint: "bg-primary/10 text-primary",
      valueClass: wallet.balance < 0 ? "text-destructive" : "text-primary",
    },
    {
      label: "Credit limit",
      value: money(wallet.creditLimit),
      sub: "Set by STS",
      icon: PiggyBank,
      tint: "bg-chart-4/10 text-chart-4",
      valueClass: "",
    },
    {
      label: "Available to spend",
      value: money(wallet.available),
      sub: "Balance + credit limit",
      icon: ArrowUpRight,
      tint: "bg-brand-gold/15 text-brand-gold",
      valueClass: "text-primary",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Finance</h1>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold">Money to book with</h2>
          <Link href="/agent/finance/transactions" className="text-xs font-medium text-primary hover:underline">
            View transactions
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {walletCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="flex items-start justify-between gap-3 pt-6">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className={cn("mt-1 truncate font-heading text-2xl font-bold", card.valueClass)}>{card.value}</p>
                  {card.sub ? <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p> : null}
                </div>
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", card.tint)}>
                  <card.icon className="size-4.5" />
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-secondary/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold">Add money</span>
              <span className="text-muted-foreground">
                Bank transfer, EVC Plus, cash at an STS office{options.online.length > 0 ? ", or pay online" : ""}
              </span>
              {pendingTopups.length > 0 ? (
                <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">
                  {pendingTopups.length} awaiting confirmation
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <WhatsAppInlineLink
                message={`Hello STS! We'd like to top up the wallet for agency ${membership.agency.name}.`}
              >
                <span className="text-xs font-medium">WhatsApp</span>
              </WhatsAppInlineLink>
              <Button size="sm" className="gap-1.5" render={<Link href="/agent/finance/top-up" />}>
                <Plus className="size-4" /> Add money
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold">Money you have earned</h2>
          <Link href="/agent/reports" className="text-xs font-medium text-primary hover:underline">
            View every entry
          </Link>
        </div>
        <EarningsPipeline
          totalEarned={earnings.totalEarned}
          inReview={earnings.inReview}
          available={earnings.available}
          paidOut={earnings.paidOut}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Available to withdraw</p>
                <p className="mt-1 truncate font-heading text-2xl font-bold text-primary">{money(earnings.available)}</p>
                {openRequest ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge className={cn("border-transparent capitalize", REQUEST_STATUS_STYLES[openRequest.status])}>
                      {openRequest.status}
                    </Badge>
                    {money(Number(openRequest.amount))} requested{" "}
                    {format(new Date(openRequest.requested_at), "d MMM yyyy")}
                  </p>
                ) : null}
              </div>
              <Button
                className="shrink-0 gap-1.5"
                disabled={earnings.available <= 0}
                render={<Link href="/agent/finance/withdrawals" />}
              >
                <Banknote className="size-4" /> Withdraw
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Last payment</p>
                {lastPayout ? (
                  <>
                    <p className="mt-1 truncate font-heading text-2xl font-bold">
                      {money(Number(lastPayout.amount))}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(new Date(lastPayout.paid_at), "d MMM yyyy")}
                      {lastPayout.method ? ` · ${lastPayout.method}` : ""}
                      {lastPayout.payout_reference ? ` · ${lastPayout.payout_reference}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 font-heading text-2xl font-bold text-muted-foreground">—</p>
                )}
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chart-3/10 text-chart-3">
                <CreditCard className="size-4.5" />
              </span>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
