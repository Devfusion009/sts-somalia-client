import { AgentMoney } from "@/components/portal/agent-money";
import { Suspense } from "react";
import { FinancePriorities } from "@/modules/agencies/components/finance-priorities";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeDollarSign, CalendarDays, CircleDollarSign, Clock3, Minus, Plus, ReceiptText, Ticket, TrendingUp, UsersRound, Wallet, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyAgency, getAgencyTeamCount, getAgencyPendingPayments,
  getAgencyPeriodMetrics, getAgencyOnboardingStatus, getAgencyRecentActivity,
  getAgencyOrders, getAgencyServiceMix,
} from "@/modules/agencies/queries";
import { resolveDateRange, percentChange, bucketLabel, type ResolvedDateRange } from "@/lib/date-range";
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
        <Metrics metricsP={metricsP} agencyId={agencyId} range={range} />
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

async function Metrics({ metricsP, agencyId, range }: {
  metricsP: MetricsPromise; agencyId: string; range: ResolvedDateRange;
}) {
  // Compare today's outstanding balances for orders created in each window,
  // rather than claiming to reconstruct a historical payment-queue snapshot.
  const [metrics, pending, previousPending] = await Promise.all([
    metricsP,
    getAgencyPendingPayments(agencyId, range),
    getAgencyPendingPayments(agencyId, { from: range.previousFrom, to: range.previousTo }),
  ]);
  const currency = metrics.revenue.currency;
  const comparisonLabel = range.key === "custom" ? "vs previous period" : `vs previous ${range.key === "24h" ? "24 hours" : `${range.key.slice(0, -1)} days`}`;
  const dueCurrencies = [...new Set([...pending.amounts, ...previousPending.amounts].map((item) => item.currency))].sort();
  if (dueCurrencies.length === 0) dueCurrencies.push(currency);
  const dueChanges = dueCurrencies.map((currency) => ({
    currency,
    current: pending.amounts.find((item) => item.currency === currency)?.amount ?? 0,
    previous: previousPending.amounts.find((item) => item.currency === currency)?.amount ?? 0,
  }));
  const dueHref = `/agent/bookings?queue=payment_due&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`;
  return (
    <div className={styles.metrics}>
      <Metric label="Bookings" icon={Ticket} tone="var(--chart-1)" value={metrics.bookings.current.toLocaleString("en-US")} href="/agent/bookings" changes={[metrics.bookings]} comparisonLabel={comparisonLabel} />
      <Metric label="Sales" icon={TrendingUp} tone="var(--chart-3)" value={<AgentMoney value={money(metrics.revenue.current, currency)} />} href="/agent/reports" changes={[metrics.revenue]} comparisonLabel={comparisonLabel} />
      <Metric label="Earnings" icon={BadgeDollarSign} tone="var(--chart-2)" value={<AgentMoney value={money(metrics.earned.current, currency)} />} href="/agent/reports" changes={[{ ...metrics.earned, currency }]} comparisonLabel={comparisonLabel} />
      <Metric label="Payment due" icon={Clock3} tone="var(--chart-4)" value={dueChanges.map((due) => <span key={due.currency} className={styles.metricAmount}><AgentMoney value={money(due.current, due.currency)} /></span>)} href={dueHref} changes={dueChanges} comparisonLabel={comparisonLabel} inverse title={`Outstanding balances · bookings created ${range.from.toLocaleDateString("en-GB")} – ${range.to.toLocaleDateString("en-GB")}`} />
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

function Metric({ label, icon: Icon, tone, value, href, changes, comparisonLabel, inverse = false, title }: {
  label: string; icon: LucideIcon; tone: string; value: React.ReactNode; href: string;
  changes: { current: number; previous: number; currency?: string }[]; comparisonLabel: string; inverse?: boolean; title?: string;
}) {
  return (
    <Link href={href} className={styles.metric} style={{ "--tone": tone } as CSSProperties} title={title}>
      <span className={styles.metricIcon}><Icon aria-hidden="true" /></span>
      <div className={styles.metricBody}>
        <dl>
          <dt className={styles.metricLabel}>{label}<ArrowRight className="size-3.5" aria-hidden="true" /></dt>
          <dd className={styles.metricValue}>{value}</dd>
        </dl>
        <div className={styles.metricFooter}>
          <div className={styles.metricChanges}>
            {changes.map(({ current, previous, currency }, index) => {
              const change = percentChange(current, previous);
              const neutral = change === null || change === 0;
              const positive = change !== null && (inverse ? change < 0 : change > 0);
              const text = change === null ? "New" : `${change > 0 ? "+" : ""}${change}%`;
              const prefix = changes.length > 1 ? `${currency} ` : "";
              const previousValue = currency ? money(previous, currency) : previous.toLocaleString("en-US");
              return <span key={currency ?? index} className={neutral ? styles.neutral : positive ? styles.up : styles.down} title={`Previous period: ${previousValue}`} aria-label={`${label}: ${prefix}${text} ${comparisonLabel}; previous period: ${previousValue}`}>
                {change === null ? null : change === 0 ? <Minus className="size-3" aria-hidden="true" /> : change < 0 ? <ArrowDownRight className="size-3" aria-hidden="true" /> : <ArrowUpRight className="size-3" aria-hidden="true" />}
                {prefix}{text}
              </span>;
            })}
          </div>
          <span>{comparisonLabel}</span>
        </div>
      </div>
    </Link>
  );
}
