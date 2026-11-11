import { AgentMoney } from "@/components/portal/agent-money";
import { Suspense } from "react";
import { FinancePriorities } from "@/modules/agencies/components/finance-priorities";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeDollarSign, CalendarDays, CircleDollarSign, Clock3, Plus, ReceiptText, Ticket, TrendingUp, UsersRound, Wallet, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyAgency, getAgencyTeamCount, getAgencyPendingPayments,
  getAgencyPeriodMetrics, getAgencyOnboardingStatus, getAgencyRecentActivity,
  getAgencyOrders, getAgencyServiceMix,
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
import { BookingWorkflow } from "./booking-workflow";
import { AgentPerformance } from "./agent-performance";
import { WorkspaceCover } from "@/components/portal/workspace-cover";
import { RecentBookings } from "./recent-bookings";
import { BookingMixChart } from "./booking-mix-chart";
import { SERVICE_ORDER, SERVICE_STYLE } from "./service-palette";
import type { CSSProperties } from "react";
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
  const ordersP = getAgencyOrders(agencyId, { page: 1 }, 6);
  const mixP = getAgencyServiceMix(agencyId, range.from, range.to);
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
          <BookingWorkflow />
        </section>
        <section className={styles.wallet} aria-label="Agency wallet">
          <dl>
            <dt className={styles.walletLabel}><Wallet className="size-4" aria-hidden="true" />Available to spend</dt>
            <dd className={styles.walletAmount}>{<AgentMoney value={money(wallet.available, "USD")} />}</dd>
          </dl>
          <div className={styles.walletActions}>
            <Link href="/agent/finance/top-up"><Plus className="size-3.5" aria-hidden="true" />Add funds</Link>
            <Link href="/agent/finance">View wallet<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
          </div>
          <dl className={styles.walletFacts}>
            <div><dt>{wallet.balance < 0 ? "Owed to STS" : "Wallet balance"}</dt><dd>{<AgentMoney value={money(Math.abs(wallet.balance), "USD")} />}</dd></div>
            <div><dt>Credit limit</dt><dd>{<AgentMoney value={money(wallet.creditLimit, "USD")} />}</dd></div>
          </dl>
        </section>
      </div>

      <Suspense fallback={<Skeleton className="h-20 rounded-2xl" />}><BookingOperations pendingP={pendingP} /></Suspense>

      <Suspense fallback={<div className={styles.metrics}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>}>
        <Metrics metricsP={metricsP} pendingP={pendingP} rangeLabel={range.label} commissionFact={commissionConfigured ? `${membership.agency.commission_rate}% commission` : "Rate not assigned"} />
      </Suspense>

      <div className={styles.overviewGrid}>
        <Suspense fallback={<PanelSkeleton rows={6} />}><LatestBookings ordersP={ordersP} /></Suspense>
        <Suspense fallback={<Skeleton className="h-[360px] rounded-2xl" />}><BookingMix mixP={mixP} rangeLabel={range.label} /></Suspense>
      </div>

      <div className={styles.contentGrid}>
        <div className="order-2 min-w-0 xl:order-1">
          <Suspense fallback={<Skeleton className="h-[360px] rounded-2xl" />}>
            <Performance metricsP={metricsP} granularity={range.granularity} />
          </Suspense>
        </div>
        <div className="order-1 space-y-5 xl:order-2">
          <section className={styles.actionPanel} aria-labelledby="workspace-actions-title">
            <h2 id="workspace-actions-title">Agency tools</h2>
            <Link href="/agent/customers" className={styles.actionRow}><span><UsersRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Customer directory</span><ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            <Link href="/agent/calendar" className={styles.actionRow}><span><CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Booking calendar</span><ArrowRight className="size-3.5" aria-hidden="true" /></Link>
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

async function Metrics({ metricsP, pendingP, rangeLabel, commissionFact }: {
  metricsP: MetricsPromise; pendingP: ReturnType<typeof getAgencyPendingPayments>; rangeLabel: string; commissionFact: string;
}) {
  const [metrics, pending] = await Promise.all([metricsP, pendingP]);
  const currency = metrics.revenue.currency;
  const due = pending.amounts[0];
  return (
    <div className={styles.metrics}>
      <Metric label="Bookings" icon={Ticket} tone="var(--chart-1)" value={metrics.bookings.current.toLocaleString("en-US")} href="/agent/bookings" change={percentChange(metrics.bookings.current, metrics.bookings.previous)} fact={rangeLabel} />
      <Metric label="Sales" icon={TrendingUp} tone="var(--chart-3)" value={<AgentMoney value={money(metrics.revenue.current, currency)} />} href="/agent/reports" change={percentChange(metrics.revenue.current, metrics.revenue.previous)} fact="Paid orders" />
      <Metric label="Earnings" icon={BadgeDollarSign} tone="var(--chart-2)" value={<AgentMoney value={money(metrics.earned.current, currency)} />} href="/agent/reports" change={percentChange(metrics.earned.current, metrics.earned.previous)} fact={commissionFact} />
      <Metric label="Payment due" icon={Clock3} tone="var(--chart-4)" value={due ? <AgentMoney value={money(due.amount, due.currency)} /> : pending.count.toLocaleString("en-US")} href="/agent/bookings?queue=payment_due" change={null} fact={`${pending.count} booking${pending.count === 1 ? "" : "s"}`} />
    </div>
  );
}

async function LatestBookings({ ordersP }: { ordersP: ReturnType<typeof getAgencyOrders> }) {
  const { orders } = await ordersP;
  return <RecentBookings orders={orders} />;
}

async function BookingMix({ mixP, rangeLabel }: { mixP: ReturnType<typeof getAgencyServiceMix>; rangeLabel: string }) {
  const mix = await mixP;
  const total = SERVICE_ORDER.reduce((sum, type) => sum + mix[type], 0);
  const slices = SERVICE_ORDER.map((type) => ({ key: type, label: SERVICE_STYLE[type].label, value: mix[type], color: SERVICE_STYLE[type].color }));
  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="booking-mix-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="booking-mix-title" className="font-heading text-base font-semibold">Booking overview</h2>
        <span className="text-xs text-muted-foreground">{rangeLabel}</span>
      </div>
      <div className="mt-4"><BookingMixChart slices={slices} total={total} /></div>
      <ul className="mt-5 space-y-2.5">
        {slices.map((slice) => {
          const Icon = SERVICE_STYLE[slice.key].icon;
          const share = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <li key={slice.key}>
              <Link href={`/agent/bookings?type=${slice.key}`} className="group flex items-center gap-3 rounded-lg px-1 py-0.5 text-sm hover:bg-muted/50">
                <span className="flex size-7 items-center justify-center rounded-lg text-white" style={{ background: slice.color }}><Icon className="size-3.5" aria-hidden="true" /></span>
                <span className="flex-1">{slice.label}</span>
                <span className="font-semibold tabular-nums">{slice.value}</span>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{share}%</span>
              </Link>
              <div className="ml-11 mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${share}%`, background: slice.color }} /></div>
            </li>
          );
        })}
      </ul>
    </section>
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

async function BookingOperations({ pendingP }: { pendingP: ReturnType<typeof getAgencyPendingPayments> }) {
  const pending = await pendingP;
  return (
    <nav className={styles.bookingOperations} aria-label="Manage agency business">
      <Link href="/agent/bookings" className={styles.operation}>
        <Ticket className="size-5" aria-hidden="true" /><span>Manage bookings</span><ArrowRight className="size-4" aria-hidden="true" />
      </Link>
      <Link href="/agent/bookings?queue=payment_due" className={styles.operation} data-attention={pending.count > 0 || undefined}>
        <Clock3 className="size-5" aria-hidden="true" /><span>Payments due</span><strong className={styles.operationCount}>{pending.count}</strong><ArrowRight className="size-4" aria-hidden="true" />
      </Link>
      <Link href="/agent/finance/transactions" className={styles.operation}>
        <ReceiptText className="size-5" aria-hidden="true" /><span>Transaction history</span><ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}

async function Onboarding({ onboardingP }: { onboardingP: ReturnType<typeof getAgencyOnboardingStatus> }) {
  return <OnboardingChecklist status={await onboardingP} />;
}

async function RecentActivity({ activityP }: { activityP: ReturnType<typeof getAgencyRecentActivity> }) {
  return <RecentActivityCard items={await activityP} />;
}

function Metric({ label, icon: Icon, tone, value, href, change, fact }: {
  label: string; icon: LucideIcon; tone: string; value: React.ReactNode; href: string; change: number | null; fact: string;
}) {
  return (
    <Link href={href} className={styles.metric} style={{ "--tone": tone } as CSSProperties}>
      <span className={styles.metricIcon}><Icon aria-hidden="true" /></span>
      <div className={styles.metricBody}>
        <dl>
          <dt className={styles.metricLabel}>{label}<ArrowRight className="size-3.5" aria-hidden="true" /></dt>
          <dd className={styles.metricValue}>{value}</dd>
        </dl>
        <div className={styles.metricFooter}>
          {change !== null ? <span className={change < 0 ? styles.down : styles.up} aria-label={`${change}% versus the previous period`}>{change < 0 ? <ArrowDownRight className="size-3" aria-hidden="true" /> : <ArrowUpRight className="size-3" aria-hidden="true" />}{change > 0 ? "+" : ""}{change}%</span> : null}
          <span>{fact}</span>
        </div>
      </div>
    </Link>
  );
}
