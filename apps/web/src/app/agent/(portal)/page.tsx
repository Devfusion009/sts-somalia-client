import { AgentMoney } from "@/components/portal/agent-money";
import { Suspense } from "react";
import { FinancePriorities } from "@/modules/agencies/components/finance-priorities";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, CalendarDays, ChartNoAxesColumnIncreasing, CircleDollarSign, Clock3, Coins, Minus, Plus, ReceiptText, Ticket, UsersRound, Wallet, type LucideIcon } from "lucide-react";
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
import { AgentPerformance } from "./agent-performance";
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

      <section className={styles.banner} aria-labelledby="dashboard-banner-title">
        <Image src="/marketing/umrah-hero.webp" alt="" fill priority unoptimized sizes="(min-width: 1024px) 60vw, 100vw" className={styles.bannerImage} />
        <div className={styles.bannerContent}>
          <h2 id="dashboard-banner-title">Book &amp; manage travel services</h2>
          <p>Flights, hotels, visas, Umrah and events for your customers.</p>
          <Link href="/agent/book" className={styles.bannerAction}>Open booking desk<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
      </section>

      <ServiceLauncher row />

      <div className={styles.metrics}>
        <Suspense fallback={<>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</>}>
          <Metrics metricsP={metricsP} rangeKey={range.key} />
        </Suspense>
        <WalletCard wallet={wallet} canTopUp={membership.roleInAgency === "owner" || membership.roleInAgency === "admin"} />
      </div>

      <div className={styles.overviewGrid}>
        <Suspense fallback={<PanelSkeleton rows={6} />}><LatestBookings ordersP={ordersP} /></Suspense>
        <Suspense fallback={<Skeleton className="h-[360px] rounded-2xl" />}><BookingMix mixP={mixP} rangeLabel={range.label} /></Suspense>
      </div>

      <Suspense fallback={<Skeleton className="h-20 rounded-2xl" />}><BookingOperations pendingP={pendingP} /></Suspense>

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

async function Metrics({ metricsP, rangeKey }: { metricsP: MetricsPromise; rangeKey: string }) {
  const metrics = await metricsP;
  const currency = metrics.revenue.currency;
  const period = rangeKey === "custom" ? "from previous period" : `from previous ${rangeKey === "24h" ? "24 hours" : `${rangeKey.slice(0, -1)} days`}`;
  return (
    <>
      <Metric label="Total bookings" icon={CalendarDays} tone="var(--chart-1)" value={metrics.bookings.current.toLocaleString("en-US")} href="/agent/bookings" current={metrics.bookings.current} previous={metrics.bookings.previous} previousText={metrics.bookings.previous.toLocaleString("en-US")} deltaText={(metrics.bookings.current - metrics.bookings.previous).toLocaleString("en-US")} period={period} />
      <Metric label="Sales value" icon={Coins} tone="var(--chart-3)" value={<AgentMoney value={money(metrics.revenue.current, currency)} />} href="/agent/reports" current={metrics.revenue.current} previous={metrics.revenue.previous} previousText={money(metrics.revenue.previous, currency)} deltaText={money(metrics.revenue.current - metrics.revenue.previous, currency)} period={period} />
      <Metric label="My commission" icon={ChartNoAxesColumnIncreasing} tone="var(--chart-2)" value={<AgentMoney value={money(metrics.earned.current, currency)} />} href="/agent/reports" current={metrics.earned.current} previous={metrics.earned.previous} previousText={money(metrics.earned.previous, currency)} deltaText={money(metrics.earned.current - metrics.earned.previous, currency)} period={period} />
    </>
  );
}

/** Rendered with the shell: the balance is already loaded, so it never waits on analytics. */
function WalletCard({ wallet, canTopUp = false }: {
  wallet: { balance: number; creditLimit: number; available: number }; canTopUp?: boolean;
}) {
  return (
    <div className={styles.metric} style={{ "--tone": "var(--chart-4)" } as CSSProperties}>
      <span className={styles.metricIcon}><Wallet aria-hidden="true" /></span>
      <div className={styles.metricBody}>
        <dl>
          <dt className={styles.metricLabel}>{wallet.balance < 0 ? "Owed to STS" : "Wallet balance"}</dt>
          <dd className={styles.metricValue}><AgentMoney value={money(Math.abs(wallet.balance), "USD")} /></dd>
        </dl>
        <div className={styles.walletCardFooter}>
          <Link href="/agent/finance" className={styles.metricPeriod}>Available <AgentMoney value={money(wallet.available, "USD")} /></Link>
          {canTopUp
            ? <Link href="/agent/finance/top-up" className={styles.addFunds}><Plus className="size-3.5" aria-hidden="true" />Add funds</Link>
            : <Link href="/agent/finance" className={styles.addFunds}>View wallet<ArrowRight className="size-3.5" aria-hidden="true" /></Link>}
        </div>
      </div>
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

function Metric({ label, icon: Icon, tone, value, href, current, previous, previousText, deltaText, period }: {
  label: string; icon: LucideIcon; tone: string; value: React.ReactNode; href: string;
  current: number; previous: number; previousText: string; deltaText: string; period: string;
}) {
  const change = percentChange(current, previous);
  // No activity last period leaves no base for a percentage, so the rise is shown as an amount.
  const text = change === null ? `${deltaText} up` : change > 0 ? `${change}% up` : change < 0 ? `${Math.abs(change)}% down` : "No change";
  const tone_ = change === null ? styles.up : change < 0 ? styles.down : change > 0 ? styles.up : styles.neutral;
  return (
    <Link href={href} className={styles.metric} style={{ "--tone": tone } as CSSProperties}>
      <span className={styles.metricIcon}><Icon aria-hidden="true" /></span>
      <div className={styles.metricBody}>
        <dl>
          <dt className={styles.metricLabel}>{label}</dt>
          <dd className={styles.metricValue}>{value}</dd>
        </dl>
        <span className={tone_} title={`Previous period: ${previousText}`} aria-label={`${label}: ${text} ${period}; previous period: ${previousText}`}>
          {change === null || change > 0 ? <ArrowUp className="size-3" aria-hidden="true" /> : change < 0 ? <ArrowDown className="size-3" aria-hidden="true" /> : <Minus className="size-3" aria-hidden="true" />}
          {text}
        </span>
        <span className={styles.metricPeriod}>{period}</span>
      </div>
    </Link>
  );
}
