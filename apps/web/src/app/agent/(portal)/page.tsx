import { Suspense } from "react";
import { FinancePriorities } from "@/modules/agencies/components/finance-priorities";
import Link from "next/link";
import { ArrowRight, CalendarDays, CircleDollarSign, Plus, Ticket, UsersRound, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyAgency, getAgencyTeamCount, getAgencyPendingPayments,
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
import { Skeleton } from "@/components/ui/skeleton";
import { PanelSkeleton } from "@/components/dashboard/skeletons";
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
  const agencyId = membership.agency.id;
  const metricsP = getAgencyPeriodMetrics(agencyId, range);
  const onboardingP = getAgencyOnboardingStatus(agencyId);
  const activityP = getAgencyRecentActivity(agencyId, 6);
  const teamCountP = getAgencyTeamCount(agencyId);
  const pendingP = getAgencyPendingPayments(agencyId);
  // The authenticated membership already contains the current wallet snapshot.
  const balance = Number(membership.agency.credit_balance);
  const creditLimit = Number(membership.agency.credit_limit);
  const wallet = { balance, creditLimit, available: balance + creditLimit };
  const commissionConfigured = membership.agency.commission_rate_set_at !== null || Number(membership.agency.commission_rate) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={membership.agency.name}
        status={<Badge variant={statusBadgeVariant(membership.agency.status)} className="capitalize">{membership.agency.status}</Badge>}
        meta={<span className="text-xs tabular-nums">{profile.agent_code ?? membership.agency.agent_code} · <Suspense fallback={<Skeleton className="inline-block h-3 w-24" />}><TeamCount countP={teamCountP} /></Suspense></span>}
        actions={<DateRangePicker currentKey={range.key} />}
      />

      <LowBalanceBanner />
      <BroadcastBanner />
      <Suspense fallback={null}><FinancePriorities agencyId={agencyId} /></Suspense>

      <div className={styles.heroGrid}>
        <section className={`${styles.launcher} ${styles.photoLauncher}`} aria-label="Start a booking">
          <WorkspaceCover compact headingLevel={2} image="/marketing/agent-booking-desk-v1.webp" title="Start a booking" actions={<Link href="/agent/book" className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Booking desk<ArrowRight className="size-3.5" aria-hidden="true" /></Link>} />
          <ServiceLauncher />
        </section>
        <section className={styles.wallet} aria-label="Agency wallet">
          <dl>
            <dt className={styles.walletLabel}><Wallet className="size-4" aria-hidden="true" />Available to spend</dt>
            <dd className={styles.walletAmount}>{money(wallet.available, "USD")}</dd>
          </dl>
          <div className={styles.walletActions}>
            <Link href="/agent/finance/top-up"><Plus className="size-3.5" aria-hidden="true" />Add funds</Link>
            <Link href="/agent/finance">View wallet<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
          </div>
          <dl className={styles.walletFacts}>
            <div><dt>{wallet.balance < 0 ? "Owed to STS" : "Wallet balance"}</dt><dd>{money(Math.abs(wallet.balance), "USD")}</dd></div>
            <div><dt>Credit limit</dt><dd>{money(wallet.creditLimit, "USD")}</dd></div>
          </dl>
        </section>
      </div>

      <Suspense fallback={<div className={styles.metrics}>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>}>
        <Metrics metricsP={metricsP} rangeLabel={range.label} commissionFact={commissionConfigured ? `${membership.agency.commission_rate}% commission` : "Rate not assigned"} />
      </Suspense>

      <div className={styles.contentGrid}>
        <Suspense fallback={<Skeleton className="h-[360px] rounded-2xl" />}>
          <Performance metricsP={metricsP} granularity={range.granularity} />
        </Suspense>
        <div className="space-y-5">
          <section className={styles.actionPanel} aria-labelledby="workspace-actions-title">
            <h2 id="workspace-actions-title">Action centre</h2>
            <Suspense fallback={<Skeleton className="h-12" />}><PendingPayments pendingP={pendingP} /></Suspense>
            <Link href="/agent/customers" className={styles.actionRow}><span><UsersRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Customer directory</span><ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            <Link href="/agent/calendar" className={styles.actionRow}><span><CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Event calendar</span><ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            <Link href="/agent/markups" className={styles.actionRow}><span><CircleDollarSign className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Markup rates</span><ArrowRight className="size-3.5" aria-hidden="true" /></Link>
          </section>
          <Suspense fallback={null}><Onboarding onboardingP={onboardingP} /></Suspense>
        </div>
      </div>

      <Suspense fallback={<PanelSkeleton rows={6} />}><RecentActivity activityP={activityP} /></Suspense>
      <AgencySupportCard agencyName={membership.agency.name} />
    </div>
  );
}

type MetricsPromise = ReturnType<typeof getAgencyPeriodMetrics>;

async function TeamCount({ countP }: { countP: ReturnType<typeof getAgencyTeamCount> }) {
  const count = await countP;
  return <>{count} team member{count === 1 ? "" : "s"}</>;
}

async function Metrics({ metricsP, rangeLabel, commissionFact }: {
  metricsP: MetricsPromise; rangeLabel: string; commissionFact: string;
}) {
  const metrics = await metricsP;
  const currency = metrics.revenue.currency;
  return (
    <div className={styles.metrics}>
      <Metric label="Bookings" value={metrics.bookings.current.toLocaleString("en-US")} href="/agent/bookings" change={percentChange(metrics.bookings.current, metrics.bookings.previous)} fact={rangeLabel} />
      <Metric label="Sales" value={money(metrics.revenue.current, currency)} href="/agent/reports" change={percentChange(metrics.revenue.current, metrics.revenue.previous)} fact="Paid orders" />
      <Metric label="Earnings" value={money(metrics.earned.current, currency)} href="/agent/reports" change={percentChange(metrics.earned.current, metrics.earned.previous)} fact={commissionFact} />
    </div>
  );
}

async function Performance({ metricsP, granularity }: {
  metricsP: MetricsPromise; granularity: "hour" | "day" | "week";
}) {
  const metrics = await metricsP;
  return (
    <AgentPerformance currency={metrics.revenue.currency} data={metrics.buckets.map((key, index) => ({
      label: bucketLabel(key, granularity),
      sales: metrics.revenue.series[index] ?? 0,
      tickets: metrics.bookings.series[index] ?? 0,
    }))} />
  );
}

async function PendingPayments({ pendingP }: { pendingP: ReturnType<typeof getAgencyPendingPayments> }) {
  const pending = await pendingP;
  return (
    <>
      <Link href="/agent/bookings" className={styles.actionRow}>
        <span><Ticket className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Awaiting payment</span>
        <strong>{pending.count}</strong>
      </Link>
      {pending.count > 0 ? <Link href="/agent/bookings" className={styles.actionRow}><span>Amount due</span><strong className="text-primary">{money(pending.amount, pending.currency)}</strong></Link> : null}
    </>
  );
}

async function Onboarding({ onboardingP }: { onboardingP: ReturnType<typeof getAgencyOnboardingStatus> }) {
  return <OnboardingChecklist status={await onboardingP} />;
}

async function RecentActivity({ activityP }: { activityP: ReturnType<typeof getAgencyRecentActivity> }) {
  return <RecentActivityCard items={await activityP} />;
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
