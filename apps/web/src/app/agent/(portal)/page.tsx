import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Hotel,
  Landmark,
  PartyPopper,
  Percent,
  Plane,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyAgency,
  getAgencyTeam,
  getAgencyWallet,
  getAgencyPendingPayments,
  getAgencyPeriodMetrics,
  getAgencyOnboardingStatus,
  getAgencyRecentActivity,
} from "@/modules/agencies/queries";
import { resolveDateRange, percentChange, bucketLabel } from "@/lib/date-range";
import { SalesTimelineChart } from "@/components/dashboard/lazy-charts";
import { LowBalanceBanner } from "@/modules/notifications/components/low-balance-banner";
import { BroadcastBanner } from "@/modules/notifications/components/broadcast-banner";
import { AgencySupportCard } from "@/modules/agencies/components/agency-support-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { OnboardingChecklist } from "./onboarding-checklist";
import { RecentActivityCard } from "./recent-activity-card";
import { cn } from "@/lib/utils";

const SERVICE_TILES = [
  {
    href: "/agent/book/flights",
    title: "Flights",
    icon: Plane,
    tint: "bg-primary/10 text-primary",
  },
  {
    href: "/agent/book/hotels",
    title: "Hotels",
    icon: Hotel,
    tint: "bg-chart-2/10 text-chart-2",
  },
  {
    href: "/agent/book/umrah",
    title: "Umrah",
    icon: Landmark,
    tint: "bg-chart-4/10 text-chart-4",
  },
  {
    href: "/agent/book/events",
    title: "Event Halls",
    icon: PartyPopper,
    tint: "bg-brand-gold/15 text-brand-gold",
  },
  {
    href: "/agent/bookings",
    title: "My Bookings",
    icon: Ticket,
    tint: "bg-secondary text-secondary-foreground",
  },
];

function money(amount: number | string, currency: string) {
  const n = Number(amount);
  const sign = n < 0 ? "−" : "";
  return `${sign}${currency} ${Math.abs(n).toFixed(0)}`;
}

export default async function AgentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null; // layout already handles this case

  const sp = await searchParams;
  const range = resolveDateRange(sp);

  const [metrics, onboarding, activity, wallet, team, pending] = await Promise.all([
    getAgencyPeriodMetrics(membership.agency.id, range),
    getAgencyOnboardingStatus(membership.agency.id),
    getAgencyRecentActivity(membership.agency.id, 8),
    getAgencyWallet(membership.agency.id),
    getAgencyTeam(membership.agency.id),
    getAgencyPendingPayments(membership.agency.id),
  ]);

  const activeTeamCount = team.length;
  const hasCredit = wallet.creditLimit > 0;
  const creditAvailable = wallet.creditLimit + Math.min(wallet.balance, 0);
  const commissionConfigured = membership.agency.commission_rate_set_at !== null;
  const currency = metrics.revenue.currency;

  return (
    <div className="space-y-6">
      <LowBalanceBanner />
      <BroadcastBanner />

      {/* Welcome header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋</p>
          <h1 className="font-heading text-2xl font-bold">{membership.agency.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "border-transparent capitalize",
              membership.agency.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {membership.agency.status}
          </Badge>
          {commissionConfigured ? (
            <Badge className="gap-1 border-transparent bg-brand-accent/10 text-brand-accent">
              <Percent className="size-3" /> {membership.agency.commission_rate}% commission
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Percent className="size-3" /> Commission rate not yet assigned
            </Badge>
          )}
        </div>
      </div>

      <OnboardingChecklist status={onboarding} />

      {/* Date range control — drives Total Bookings, Revenue, and Earned together */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Showing {range.label.toLowerCase()} for bookings, revenue, and earnings below.</p>
        <DateRangePicker currentKey={range.key} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          icon={Ticket}
          label="Total Bookings"
          value={String(metrics.bookings.current)}
          sub={range.label}
          change={percentChange(metrics.bookings.current, metrics.bookings.previous)}
          series={metrics.bookings.series}
          tint="bg-primary/10 text-primary"
        />
        <KpiCard
          icon={CalendarClock}
          label="Revenue"
          value={money(metrics.revenue.current, currency)}
          sub={`Paid orders · ${range.label.toLowerCase()}`}
          change={percentChange(metrics.revenue.current, metrics.revenue.previous)}
          series={metrics.revenue.series}
          tint="bg-chart-3/10 text-chart-3"
        />
        <KpiCard
          icon={Percent}
          label="Earned"
          value={money(metrics.earned.current, currency)}
          sub={range.label}
          change={percentChange(metrics.earned.current, metrics.earned.previous)}
          series={metrics.earned.series}
          tint="bg-brand-accent/10 text-brand-accent"
          footer={
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
              <span>
                Your markup: <span className="font-medium text-foreground">{money(metrics.earned.markupEarned, currency)}</span>
              </span>
              <span>
                STS commission: <span className="font-medium text-foreground">{money(metrics.earned.commissionEarned, currency)}</span>
              </span>
            </div>
          }
        />
        <KpiCard
          icon={Wallet}
          label="Wallet Balance"
          value={money(wallet.balance, currency)}
          sub={hasCredit ? `Credit available: ${money(creditAvailable, currency)}` : "Prepaid wallet"}
          tint="bg-brand-gold/15 text-brand-gold"
        />
        <KpiCard
          icon={CalendarClock}
          label="Pending Payments"
          value={String(pending.count)}
          sub={money(pending.amount, pending.currency)}
          tint="bg-muted text-muted-foreground"
        />
        <KpiCard
          icon={Users}
          label="Team Members"
          value={String(activeTeamCount)}
          sub="Active access"
          tint="bg-chart-4/10 text-chart-4"
          href="/agent/team"
        />
      </div>

      <SalesTimelineChart
        currency={currency}
        data={metrics.buckets.map((key, i) => ({
          label: bucketLabel(key, range.granularity),
          sales: metrics.revenue.series[i] ?? 0,
          tickets: metrics.bookings.series[i] ?? 0,
        }))}
      />

      {/* Service tiles */}
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold">Book for your clients</h2>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SERVICE_TILES.map((tile) => (
            <Link key={tile.href} href={tile.href} className="group">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                <CardContent className="flex h-full flex-col items-start gap-3 pt-6">
                  <span className={cn("flex size-11 items-center justify-center rounded-full", tile.tint)}>
                    <tile.icon className="size-5" />
                  </span>
                  <div className="flex-1">
                    <p className="font-heading text-sm font-bold">{tile.title}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                    Open <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <RecentActivityCard items={activity} />

      <AgencySupportCard agencyName={membership.agency.name} />
    </div>
  );
}
