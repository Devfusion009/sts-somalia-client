import { AgentMoney } from "@/components/portal/agent-money";
import { randomUUID } from "node:crypto";
import { TransferEarningsForm } from "./transfer-earnings-form";
import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowRight, Banknote, Plus, ReceiptText, Wallet } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/money";
import styles from "./finance.module.css";
import { EarningsPipeline } from "./earnings-pipeline";

export const metadata: Metadata = { title: "Wallet & finance" };

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
  const openRequest = requests.find((r) => r.status === "pending" || r.status === "approved" || r.status === "processing") ?? null;

  const negative = wallet.balance < 0;

  return (
    <div className={styles.financePage}>
      <PageHeader title="Wallet & finance" actions={
        <Button variant="outline" render={<Link href="/agent/finance/transactions" />}>
          <ReceiptText data-icon="inline-start" aria-hidden="true" />Transactions
        </Button>
      } />

      <section className={styles.walletOverview} aria-label="Agency wallet">
        <div className={styles.balanceHero}>
          <div className={styles.heroHeading}><span><Wallet aria-hidden="true" />Agency wallet</span><span className={styles.currencyTag}>USD</span></div>
          <dl className={styles.spendable} data-negative={wallet.available < 0 || undefined}>
            <dt>Available to spend</dt>
            <dd><AgentMoney value={money(wallet.available, "USD")} /></dd>
          </dl>
          <div className={styles.heroActions}>
            <Link href="/agent/finance/top-up" className={styles.addMoney}><Plus aria-hidden="true" />Add money</Link>
            <WhatsAppInlineLink message={`Hello STS! We'd like to top up the wallet for agency ${membership.agency.name}.`} className={styles.supportLink}>WhatsApp support<ArrowRight aria-hidden="true" /></WhatsAppInlineLink>
          </div>
        </div>
        <div className={styles.walletBreakdown}>
          <div className={styles.panelHeading}>
            <h2>Wallet summary</h2>
            {pendingTopups.length > 0 ? <Badge variant="warning" render={<Link href="/agent/finance/top-up" />}>{pendingTopups.length} pending top-up{pendingTopups.length === 1 ? "" : "s"}</Badge> : null}
          </div>
          <dl className={styles.walletFacts}>
            <div data-negative={negative || undefined}>
              <dt>{negative ? "Owed to STS" : "Wallet balance"}</dt>
              <dd>{negative ? "−" : ""}<AgentMoney value={money(Math.abs(wallet.balance), "USD")} /></dd>
            </div>
            <div><dt>Credit limit</dt><dd><AgentMoney value={money(wallet.creditLimit, "USD")} /></dd></div>
          </dl>
        </div>
      </section>

      <section className={styles.earningsPanel} aria-labelledby="earnings-title">
        <div className={styles.panelHeading}>
          <h2 id="earnings-title">Earnings overview</h2>
          <Link href="/agent/reports" className={styles.textLink}>All entries<ArrowRight aria-hidden="true" /></Link>
        </div>
        <EarningsPipeline totalEarned={earnings.totalEarned} inReview={earnings.inReview} available={earnings.available} paidOut={earnings.paidOut} />
        <div className={styles.earningsActions}>
          {["owner", "admin"].includes(membership.roleInAgency) ? <TransferEarningsForm amount={earnings.available} transferId={randomUUID()} disabled={earnings.available <= 0 || !!openRequest} /> : null}
          <Button variant="default" disabled={earnings.available <= 0} render={<Link href="/agent/finance/withdrawals" />}>
            <Banknote data-icon="inline-start" aria-hidden="true" />Withdraw earnings
          </Button>
        </div>
      </section>

      <section className={styles.settlements} aria-labelledby="settlements-title">
        <div className={styles.sectionHeading}>
          <h2 id="settlements-title">Withdrawals & settlements</h2>
          <Link href="/agent/finance/withdrawals" className={styles.textLink}>View withdrawals<ArrowRight aria-hidden="true" /></Link>
        </div>
        <div className={styles.settlementGrid}>
          <div className={styles.settlementItem}>
            <div className={styles.settlementLabel}><Banknote aria-hidden="true" /><h3>Open withdrawal request</h3></div>
            {openRequest ? <>
              <div className={styles.settlementValue}>
                <strong><AgentMoney value={money(Number(openRequest.amount), "USD")} /></strong>
                <Badge variant={statusBadgeVariant(openRequest.status, REQUEST_VARIANT_OVERRIDES)} className="capitalize">{openRequest.status}</Badge>
              </div>
              <span className={styles.settlementMeta}>Requested {format(new Date(openRequest.requested_at), "d MMM yyyy")}</span>
            </> : <span className={styles.emptyValue}>No open requests</span>}
          </div>
          <div className={styles.settlementItem}>
            <div className={styles.settlementLabel}><ArrowDownLeft aria-hidden="true" /><h3>Last earnings settlement</h3></div>
            {lastPayout ? <>
              <div className={styles.settlementValue}><strong><AgentMoney value={money(Number(lastPayout.amount), "USD")} /></strong></div>
              <span className={styles.settlementMeta}>
                {format(new Date(lastPayout.paid_at), "d MMM yyyy")}
                {lastPayout.method === "wallet" ? " · Transferred to wallet" : `${lastPayout.method ? ` · ${lastPayout.method}` : ""}${lastPayout.payout_reference ? ` · ${lastPayout.payout_reference}` : ""}`}
              </span>
            </> : <span className={styles.emptyValue}>No settlements yet</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
