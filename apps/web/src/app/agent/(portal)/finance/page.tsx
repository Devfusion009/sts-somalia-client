import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Banknote, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyAgency,
  getAgencyWallet,
  getAgencyEarningsSummary,
  getAgencyCommissionPayouts,
  getAgencyPayoutRequests,
  getAgencyTopupRequests,
} from "@/modules/agencies/queries";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatStrip, StatStripItem } from "@/components/dashboard/filter-chips";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import { EarningsPipeline } from "./earnings-pipeline";

export const metadata: Metadata = { title: "Finance" };

/** Approved = accepted but not yet transferred, so it reads as in motion, not done. */
const REQUEST_VARIANT_OVERRIDES = { approved: "info" } as const;

export default async function AgentFinancePage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const [wallet, earnings, payouts, requests, topups] = await Promise.all([
    getAgencyWallet(membership.agency.id),
    getAgencyEarningsSummary(membership.agency.id),
    getAgencyCommissionPayouts(membership.agency.id, 1),
    getAgencyPayoutRequests(membership.agency.id),
    getAgencyTopupRequests(membership.agency.id),
  ]);
  const pendingTopups = topups.filter((t) => t.status === "pending");

  const lastPayout = payouts[0] ?? null;
  const openRequest = requests.find((r) => r.status === "pending" || r.status === "approved") ?? null;

  const negative = wallet.balance < 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance"
        actions={
          <>
            <Button
              variant="outline"
              disabled={earnings.available <= 0}
              render={<Link href="/agent/finance/withdrawals" />}
            >
              <Banknote data-icon="inline-start" aria-hidden="true" /> Withdraw
            </Button>
            <Button render={<Link href="/agent/finance/top-up" />}>
              <Plus data-icon="inline-start" aria-hidden="true" /> Add money
            </Button>
          </>
        }
      />

      <section className="space-y-3">
        <SectionHead title="Wallet">
          {pendingTopups.length > 0 ? (
            <Badge variant="warning" className="tabular-nums" render={<Link href="/agent/finance/top-up" />}>
              {pendingTopups.length} top-up{pendingTopups.length === 1 ? "" : "s"} pending
            </Badge>
          ) : null}
          <WhatsAppInlineLink
            message={`Hello STS! We'd like to top up the wallet for agency ${membership.agency.name}.`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-auto")}
          >
            WhatsApp
          </WhatsAppInlineLink>
          <Button variant="outline" size="sm" render={<Link href="/agent/finance/transactions" />}>
            Transactions
          </Button>
        </SectionHead>
        <StatStrip cols={3}>
          <StatStripItem
            label="Balance"
            value={
              <span className={negative ? "text-destructive" : undefined}>
                {negative ? "−" : ""}
                {money(Math.abs(wallet.balance), "USD")}
              </span>
            }
            sub={negative ? "Owed to STS" : undefined}
          />
          <StatStripItem label="Credit limit" value={money(wallet.creditLimit, "USD")} />
          <StatStripItem label="Available to spend" value={money(wallet.available, "USD")} tone="primary" />
        </StatStrip>
      </section>

      <section className="space-y-3">
        <SectionHead title="Earnings">
          <Button variant="outline" size="sm" className="ml-auto" render={<Link href="/agent/reports" />}>
            All entries
          </Button>
        </SectionHead>
        <EarningsPipeline
          totalEarned={earnings.totalEarned}
          inReview={earnings.inReview}
          available={earnings.available}
          paidOut={earnings.paidOut}
        />

        <Card>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 sm:divide-x sm:divide-border">
              <div className="min-w-0 space-y-1 sm:pr-4">
                <dt className="text-xs text-muted-foreground">Open withdrawal request</dt>
                {openRequest ? (
                  <dd className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-lg font-semibold tabular-nums">
                      {money(Number(openRequest.amount), "USD")}
                    </span>
                    <Badge
                      variant={statusBadgeVariant(openRequest.status, REQUEST_VARIANT_OVERRIDES)}
                      className="capitalize"
                    >
                      {openRequest.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(openRequest.requested_at), "d MMM yyyy")}
                    </span>
                  </dd>
                ) : (
                  <dd className="font-heading text-lg font-semibold text-muted-foreground">None</dd>
                )}
              </div>
              <div className="min-w-0 space-y-1 sm:pl-4">
                <dt className="text-xs text-muted-foreground">Last payout</dt>
                {lastPayout ? (
                  <dd>
                    <span className="font-heading text-lg font-semibold tabular-nums">
                      {money(Number(lastPayout.amount), "USD")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground tabular-nums">
                      {format(new Date(lastPayout.paid_at), "d MMM yyyy")}
                      {lastPayout.method ? ` · ${lastPayout.method}` : ""}
                      {lastPayout.payout_reference ? ` · ${lastPayout.payout_reference}` : ""}
                    </span>
                  </dd>
                ) : (
                  <dd className="font-heading text-lg font-semibold text-muted-foreground">None</dd>
                )}
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SectionHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}
