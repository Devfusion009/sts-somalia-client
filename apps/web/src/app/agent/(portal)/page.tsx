import Link from "next/link";
import { CalendarClock, Percent, Plus, Ticket, Wallet } from "lucide-react";
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { money } from "@/lib/money";
import { OnboardingChecklist } from "./onboarding-checklist";
import { RecentActivityCard } from "./recent-activity-card";

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
  const onboardingOpen = !(onboarding.hasFirstBooking && onboarding.hasMarkupConfigured && onboarding.hasInvitedTeamMember);
  const actionPanels = (pending.count > 0 ? 1 : 0) + (onboardingOpen ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={membership.agency.name}
        status={
          <Badge variant={statusBadgeVariant(membership.agency.status)} className="capitalize">
            {membership.agency.status}
          </Badge>
        }
        meta={
          <span className="tabular-nums">
            {commissionConfigured ? `${membership.agency.commission_rate}% commission` : "Commission rate not assigned"}
            {" · "}
            {activeTeamCount} team member{activeTeamCount === 1 ? "" : "s"}
          </span>
        }
        actions={
          <>
            <DateRangePicker currentKey={range.key} />
            <Button render={<Link href="/agent/book" />}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              New booking
            </Button>
          </>
        }
      />

      <LowBalanceBanner />
      <BroadcastBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Ticket}
          label="Bookings"
          value={metrics.bookings.current.toLocaleString("en-US")}
          sub={range.label}
          change={percentChange(metrics.bookings.current, metrics.bookings.previous)}
          series={metrics.bookings.series}
          href="/agent/bookings"
        />
        <KpiCard
          icon={CalendarClock}
          label="Revenue"
          value={money(metrics.revenue.current, currency)}
          sub="Paid orders"
          change={percentChange(metrics.revenue.current, metrics.revenue.previous)}
          series={metrics.revenue.series}
        />
        <KpiCard
          icon={Percent}
          label="Earned"
          value={money(metrics.earned.current, currency)}
          change={percentChange(metrics.earned.current, metrics.earned.previous)}
          series={metrics.earned.series}
          href="/agent/reports"
          footer={
            <dl className="mt-1 grid grid-cols-2 gap-2 border-t border-border pt-2 text-xs">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Markup</dt>
                <dd className="truncate font-medium tabular-nums">{money(metrics.earned.markupEarned, currency)}</dd>
              </div>
              <div className="min-w-0 text-right">
                <dt className="text-muted-foreground">Commission</dt>
                <dd className="truncate font-medium tabular-nums">{money(metrics.earned.commissionEarned, currency)}</dd>
              </div>
            </dl>
          }
        />
        <KpiCard
          icon={Wallet}
          label="Wallet balance"
          value={money(wallet.balance, currency)}
          sub={hasCredit ? `${money(creditAvailable, currency)} credit available` : "Prepaid"}
          href="/agent/finance"
        />
      </div>

      {actionPanels > 0 ? (
        <div className={actionPanels > 1 ? "grid items-start gap-4 lg:grid-cols-2" : "grid gap-4"}>
          {pending.count > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Awaiting payment</CardTitle>
                <CardAction>
                  <Button size="sm" variant="outline" render={<Link href="/agent/bookings" />}>
                    Review
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Orders</dt>
                    <dd className="font-heading text-2xl font-semibold tabular-nums">{pending.count}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Amount due</dt>
                    <dd className="truncate font-heading text-2xl font-semibold tabular-nums text-[color-mix(in_oklch,var(--brand-gold),black_30%)] dark:text-brand-gold">
                      {money(pending.amount, pending.currency)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ) : null}
          <OnboardingChecklist status={onboarding} />
        </div>
      ) : null}

      <SalesTimelineChart
        currency={currency}
        data={metrics.buckets.map((key, i) => ({
          label: bucketLabel(key, range.granularity),
          sales: metrics.revenue.series[i] ?? 0,
          tickets: metrics.bookings.series[i] ?? 0,
        }))}
      />

      <RecentActivityCard items={activity} />

      <AgencySupportCard agencyName={membership.agency.name} />
    </div>
  );
}
