import { FinancePriorities } from "@/modules/agencies/components/finance-priorities";
import Link from "next/link";
import { ArrowRight, CalendarDays, CircleDollarSign, Plus, Ticket, UsersRound, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyAgency, getAgencyTeam, getAgencyWallet, getAgencyPendingPayments,
  getAgencyPeriodMetrics, getAgencyOnboardingStatus, getAgencyRecentActivity,
} from "@/modules/agencies/queries";
import { resolveDateRange, percentChange, bucketLabel } from "@/lib/date-range";
import { LowBalanceBanner } from "@/modules/notifications/components/low-balance-banner";
import { BroadcastBanner } from "@/modules/notifications/components/broadcast-banner";
import { AgencySupportCard } from "@/modules/agencies/components/agency-support-card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { money } from "@/lib/money";
import { OnboardingChecklist } from "./onboarding-checklist";
import { RecentActivityCard } from "./recent-activity-card";
import { ServiceLauncher } from "./service-launcher";
import { AgentPerformance } from "./agent-performance";
import { WorkspaceCover } from "@/components/portal/workspace-cover";
import styles from "./workspace.module.css";

export default async function AgentDashboardPage({ searchParams }: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;
  const range = resolveDateRange(await searchParams);
  const [metrics, onboarding, activity, wallet, team, pending] = await Promise.all([
    getAgencyPeriodMetrics(membership.agency.id, range),
    getAgencyOnboardingStatus(membership.agency.id),
    getAgencyRecentActivity(membership.agency.id, 6),
    getAgencyWallet(membership.agency.id),
    getAgencyTeam(membership.agency.id),
    getAgencyPendingPayments(membership.agency.id),
  ]);
  const currency = metrics.revenue.currency;
  const commissionConfigured = membership.agency.commission_rate_set_at !== null || Number(membership.agency.commission_rate) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={membership.agency.name}
        status={<Badge variant={statusBadgeVariant(membership.agency.status)} className="capitalize">{membership.agency.status}</Badge>}
        meta={<span className="text-xs tabular-nums">{profile.agent_code ?? membership.agency.agent_code} · {team.length} team member{team.length === 1 ? "" : "s"}</span>}
        actions={<DateRangePicker currentKey={range.key} />}
      />

      <LowBalanceBanner />
      <BroadcastBanner />
      <FinancePriorities agencyId={membership.agency.id} />

      <div className={styles.heroGrid}>
        <section className={`${styles.launcher} ${styles.photoLauncher}`} aria-label="Start a booking">
          <WorkspaceCover compact headingLevel={2} image="/marketing/hero-aircraft.webp" title="Start a booking" actions={<Link href="/agent/book" className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Booking desk<ArrowRight className="size-3.5" aria-hidden="true" /></Link>} />
          <ServiceLauncher />
        </section>
        <section className={styles.wallet} aria-label="Agency wallet">
          <dl>
            <dt className={styles.walletLabel}><Wallet className="size-4" aria-hidden="true" />Wallet balance</dt>
            <dd className={styles.walletAmount}>{money(wallet.balance, "USD")}</dd>
          </dl>
          <div className={styles.walletActions}>
            <Link href="/agent/finance/top-up"><Plus className="size-3.5" aria-hidden="true" />Add funds</Link>
            <Link href="/agent/finance">View wallet<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
          </div>
          <dl className={styles.walletFacts}>
            <div><dt>Available to spend</dt><dd>{money(wallet.available, "USD")}</dd></div>
            <div><dt>Credit limit</dt><dd>{money(wallet.creditLimit, "USD")}</dd></div>
          </dl>
        </section>
      </div>

      <div className={styles.metrics}>
        <Metric label="Bookings" value={metrics.bookings.current.toLocaleString("en-US")} href="/agent/bookings" change={percentChange(metrics.bookings.current, metrics.bookings.previous)} fact={range.label} />
        <Metric label="Sales" value={money(metrics.revenue.current, currency)} href="/agent/reports" change={percentChange(metrics.revenue.current, metrics.revenue.previous)} fact="Paid orders" />
        <Metric label="Earnings" value={money(metrics.earned.current, currency)} href="/agent/reports" change={percentChange(metrics.earned.current, metrics.earned.previous)} fact={commissionConfigured ? `${membership.agency.commission_rate}% commission` : "Rate not assigned"} />
      </div>

      <div className={styles.contentGrid}>
        <AgentPerformance currency={currency} data={metrics.buckets.map((key, index) => ({
          label: bucketLabel(key, range.granularity),
          sales: metrics.revenue.series[index] ?? 0,
          tickets: metrics.bookings.series[index] ?? 0,
        }))} />
        <div className="space-y-5">
          <section className={styles.actionPanel} aria-labelledby="workspace-actions-title">
            <h2 id="workspace-actions-title">Action centre</h2>
            <Link href="/agent/bookings" className={styles.actionRow}>
              <span><Ticket className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Awaiting payment</span>
              <strong>{pending.count}</strong>
            </Link>
            {pending.count > 0 ? <Link href="/agent/bookings" className={styles.actionRow}><span>Amount due</span><strong className="text-primary">{money(pending.amount, pending.currency)}</strong></Link> : null}
            <Link href="/agent/customers" className={styles.actionRow}><span><UsersRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Customer directory</span><ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            <Link href="/agent/calendar" className={styles.actionRow}><span><CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Event calendar</span><ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            <Link href="/agent/markups" className={styles.actionRow}><span><CircleDollarSign className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Markup rates</span><ArrowRight className="size-3.5" aria-hidden="true" /></Link>
          </section>
          <OnboardingChecklist status={onboarding} />
        </div>
      </div>

      <RecentActivityCard items={activity} />
      <AgencySupportCard agencyName={membership.agency.name} />
    </div>
  );
}

function Metric({ label, value, href, change, fact }: {
  label: string; value: string; href: string; change: number | null; fact: string;
}) {
  return (
    <Link href={href} className={styles.metric}>
      <dl>
        <dt className={styles.metricLabel}>{label}<ArrowRight className="size-3.5" aria-hidden="true" /></dt>
        <dd className={styles.metricValue}>{value}</dd>
      </dl>
      <div className={styles.metricFooter}>
        {change !== null ? <span className={change < 0 ? styles.down : styles.up} aria-label={`${change}% versus the previous period`}>{change > 0 ? "+" : ""}{change}%</span> : null}
        <span>{fact}</span>
      </div>
    </Link>
  );
}
