import { FinancePriorities } from "@/modules/agencies/components/finance-priorities";
import { Suspense } from "react";
import Link from "next/link";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  Users,
  ShoppingCart,
  ClipboardCheck,
  Building2,
  Plane,
  FileText,
  Landmark,
  PartyPopper,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  Eye,
  AlertCircle,
  Clock,
  CheckCircle2,
  BadgeCheck,
  XCircle,
  Ban,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import {
  getDashboardStats,
  getRevenueTrendRanged,
  getBookingsByTypeRanged,
  getRecentOrdersWithItems,
  getTopHotels,
  getVisaStatsAdmin,
  getUpcomingHallBookings,
  getUserGrowth,
  getB2BvsB2C,
  getAgentLeaderboard,
  getStatCardTrends,
} from "@/modules/admin/queries";
import { VISA_STAGE_LABELS, type VisaStage } from "@/modules/visa/workflow";
import {
  RevenueTrendChart,
  BookingsByTypeChart,
  UsersByRoleChart,
  UserGrowthChart,
  B2BvsB2CChart,
  Sparkline,
} from "@/components/dashboard/lazy-charts";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { resolveDateRange, percentChange } from "@/lib/date-range";
import { PanelPairSkeleton, PanelSkeleton, StatRowSkeleton } from "@/components/dashboard/skeletons";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth/session";
import { AdminWorkspace } from "./admin-workspace";
import { RefreshOrdersButton } from "./orders/refresh-orders-button";

// Deliberately plural and separate from ROLE_LABELS in lib/auth/roles.ts:
// these name chart series ("Agents"), not an individual's role ("Travel
// Agent"). Typed over AppRole so adding an enum value fails to compile here
// rather than quietly dropping a slice from the users-by-role chart.
const ROLE_CHART_LABELS: Record<AppRole, string> = {
  customer: "Customers",
  agent: "Agents",
  hotel_partner: "Hotel Partners",
  hotel_manager: "Hotel Managers",
  venue_manager: "Venue Managers",
  affiliate: "Affiliates",
  venue_partner: "Venue Partners",
  admin: "Admins",
};

/**
 * Row icon tints. Neutral by default; color is reserved for a stage that
 * carries meaning (done, stopped, waiting on the customer).
 */
const TONES = {
  neutral: "bg-muted text-muted-foreground",
  teal: "bg-primary/10 text-primary",
  gold: "bg-brand-gold/15 text-[color-mix(in_oklch,var(--brand-gold),black_35%)] dark:text-brand-gold",
  red: "bg-destructive/10 text-destructive",
} as const;

type Tone = keyof typeof TONES;

// Missing a "hall" entry here previously meant IconChip rendered
// <undefined /> the moment any order's first item was a hall booking —
// React throws "Element type is invalid" and the whole dashboard 500s.
// hall was added to order_item_type before this map existed and never
// got wired in since no hall order had reached "recent orders" yet.
const ITEM_TYPE_ICON: Record<string, LucideIcon> = {
  hotel: Building2,
  flight: Plane,
  visa: FileText,
  umrah: Landmark,
  hall: PartyPopper,
};

/** Pipeline stage → the Applications queue that lists it. */
const VISA_STAGE_QUEUE: Record<string, string> = {
  submitted: "new",
  in_review: "document_review",
  additional_info_required: "customer_action",
  ready_for_processing: "ready_for_submission",
  processing: "processing",
  approved: "approved",
  issued: "issued",
  rejected: "refused",
  cancelled: "cancelled",
};

/** Pipeline order — where a visa application sits in its lifecycle, not object key order. */
const VISA_PIPELINE_STAGES = [
  "submitted",
  "in_review",
  "additional_info_required",
  "ready_for_processing",
  "processing",
  "approved",
  "issued",
  "rejected",
  "cancelled",
] as const;

const VISA_STAGE_ICON: Record<string, LucideIcon> = {
  submitted: Send,
  in_review: Eye,
  additional_info_required: AlertCircle,
  ready_for_processing: ClipboardCheck,
  processing: Clock,
  approved: CheckCircle2,
  issued: BadgeCheck,
  rejected: XCircle,
  cancelled: Ban,
};

const VISA_STAGE_TONE: Record<string, Tone> = {
  submitted: "neutral",
  in_review: "neutral",
  additional_info_required: "gold",
  ready_for_processing: "neutral",
  processing: "neutral",
  approved: "teal",
  issued: "teal",
  rejected: "red",
  cancelled: "red",
};

/** `in_review` → `in review`; the Badge capitalizes. */
function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function money(amount: number, currency = "USD") {
  return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
}

function shortDate(value: string) {
  return format(parseISO(value), "MMM d, yyyy");
}

/** Soft lift so white cards separate from the tinted page background. */
const CARD = "shadow-sm shadow-foreground/5";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveDateRange(sp);
  const rangeQuery = `range=${range.key}${range.key === "custom" ? `&from=${sp.from}&to=${sp.to}` : ""}`;

  // Every query starts now, in parallel, but nothing is awaited here: each
  // section below awaits only what it draws and streams in on its own, so the
  // header and skeletons paint immediately instead of after the slowest of
  // eleven round trips to the database.
  const statsP = getDashboardStats();
  const trendsP = getStatCardTrends(range.from, range.to, range.previousFrom, range.previousTo, range.granularity);
  const revenueTrendP = getRevenueTrendRanged(range.from, range.to, range.granularity);
  const bookingsByTypeP = getBookingsByTypeRanged(range.from, range.to);
  const userGrowthP = getUserGrowth(range.from, range.to, range.granularity);
  const b2bVsB2cP = getB2BvsB2C(range.from, range.to);
  const recentOrdersP = getRecentOrdersWithItems(6);
  const topHotelsP = getTopHotels(5);
  const leaderboardP = getAgentLeaderboard(range.from, range.to, 10);
  const visaStatsP = getVisaStatsAdmin();
  const upcomingHallsP = getUpcomingHallBookings(5);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" actions={<div className="flex flex-wrap items-center gap-3"><RefreshOrdersButton /><DateRangePicker currentKey={range.key} /></div>} />

      <AdminWorkspace />
      <Suspense fallback={null}><FinancePriorities /></Suspense>

      <Suspense fallback={<StatRowSkeleton />}>
        <StatsSection statsP={statsP} trendsP={trendsP} />
      </Suspense>

      <Suspense fallback={<PanelPairSkeleton />}>
        <RevenueSection revenueTrendP={revenueTrendP} bookingsByTypeP={bookingsByTypeP} />
      </Suspense>

      <Suspense fallback={<PanelPairSkeleton />}>
        <GrowthSection userGrowthP={userGrowthP} b2bVsB2cP={b2bVsB2cP} rangeQuery={rangeQuery} />
      </Suspense>

      <Suspense fallback={<PanelPairSkeleton rows={4} />}>
        <OrdersSection recentOrdersP={recentOrdersP} topHotelsP={topHotelsP} />
      </Suspense>

      <Suspense fallback={<PanelSkeleton rows={4} />}>
        <LeaderboardSection leaderboardP={leaderboardP} rangeQuery={rangeQuery} />
      </Suspense>

      <Suspense fallback={<PanelPairSkeleton rows={4} />}>
        <VisaSection visaStatsP={visaStatsP} upcomingHallsP={upcomingHallsP} />
      </Suspense>

      <Suspense fallback={<PanelSkeleton />}>
        <RolesSection statsP={statsP} />
      </Suspense>
    </div>
  );
}

async function StatsSection({
  statsP,
  trendsP,
}: {
  statsP: ReturnType<typeof getDashboardStats>;
  trendsP: ReturnType<typeof getStatCardTrends>;
}) {
  const [stats, statTrends] = await Promise.all([statsP, trendsP]);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={stats.totalUsers}
          change={percentChange(statTrends.users.current, statTrends.users.previous)}
          series={statTrends.users.series}
          href="/admin/users"
        />
        <StatCard
          label="Total orders"
          value={stats.totalOrders}
          change={percentChange(statTrends.orders.current, statTrends.orders.previous)}
          series={statTrends.orders.series}
          href="/admin/orders"
        />
        <StatCard
          label="Collected revenue"
          value={money(stats.revenue)}
          change={percentChange(statTrends.revenue.current, statTrends.revenue.previous)}
          series={statTrends.revenue.series}
          href="/admin/orders"
        />
        <StatCard
          label="Pending applications"
          value={stats.pendingApplications}
          href="/admin/applications?status=pending"
        />
      </div>

      {stats.pendingApplications > 0 ? (
        <Card className={cn(CARD, "bg-primary/5 ring-primary/20")}>
          <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm font-medium">
              <span className="tabular-nums">{stats.pendingApplications}</span> application
              {stats.pendingApplications > 1 ? "s" : ""} pending review
              <span className="block font-normal text-muted-foreground tabular-nums sm:inline">
                <span className="hidden sm:inline"> · </span>
                {stats.pendingAgency} agency, {stats.pendingPartner} partner, {stats.pendingVenue} venue, {stats.pendingAffiliate} affiliate
              </span>
            </p>
            <Button className="shrink-0 max-sm:w-full" render={<Link href="/admin/applications" />}>
              Review
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

async function RevenueSection({
  revenueTrendP,
  bookingsByTypeP,
}: {
  revenueTrendP: ReturnType<typeof getRevenueTrendRanged>;
  bookingsByTypeP: ReturnType<typeof getBookingsByTypeRanged>;
}) {
  const [revenueTrend, bookingsByType] = await Promise.all([revenueTrendP, bookingsByTypeP]);
  return (
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className={cn(CARD, "lg:col-span-3")}>
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={revenueTrend} />
          </CardContent>
        </Card>

        <Card className={cn(CARD, "lg:col-span-2")}>
          <CardHeader>
            <CardTitle>Bookings by type</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingsByTypeChart data={bookingsByType} />
          </CardContent>
        </Card>
      </div>
  );
}

async function GrowthSection({
  userGrowthP,
  b2bVsB2cP,
  rangeQuery,
}: {
  userGrowthP: ReturnType<typeof getUserGrowth>;
  b2bVsB2cP: ReturnType<typeof getB2BvsB2C>;
  rangeQuery: string;
}) {
  const [userGrowth, b2bVsB2c] = await Promise.all([userGrowthP, b2bVsB2cP]);
  return (
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className={cn(CARD, "lg:col-span-3")}>
          <CardHeader>
            <CardTitle>User growth</CardTitle>
            <CardAction>
              <ExportLink href={`/admin/reports/user-growth/export?${rangeQuery}`} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <UserGrowthChart data={userGrowth.map((r) => ({ label: r.label, total: r.total }))} />
          </CardContent>
        </Card>

        <Card className={cn(CARD, "lg:col-span-2")}>
          <CardHeader>
            <CardTitle>B2B vs B2C</CardTitle>
            <CardAction>
              <ExportLink href={`/admin/reports/b2b-b2c/export?${rangeQuery}`} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <B2BvsB2CChart data={b2bVsB2c} />
          </CardContent>
        </Card>
      </div>
  );
}

async function OrdersSection({
  recentOrdersP,
  topHotelsP,
}: {
  recentOrdersP: ReturnType<typeof getRecentOrdersWithItems>;
  topHotelsP: ReturnType<typeof getTopHotels>;
}) {
  const [recentOrders, topHotels] = await Promise.all([recentOrdersP, topHotelsP]);
  return (
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className={cn(CARD, "lg:col-span-3")}>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <CardAction>
              <Button size="sm" variant="outline" render={<Link href="/admin/orders" />}>
                View all
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {recentOrders.length === 0 ? (
              <EmptyRow icon={ShoppingCart}>No orders</EmptyRow>
            ) : (
              recentOrders.map((order) => {
                const firstType = order.order_items[0]?.item_type;
                const Icon = (firstType && ITEM_TYPE_ICON[firstType]) || ShoppingCart;
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <IconChip icon={Icon} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{order.customer?.full_name ?? "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {order.order_number} · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">
                        {money(Number(order.total), order.currency)}
                      </span>
                      <Badge variant={statusBadgeVariant(order.status)} className="capitalize">
                        {humanize(order.status)}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className={cn(CARD, "lg:col-span-2")}>
          <CardHeader>
            <CardTitle>Top hotels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {topHotels.length === 0 ? (
              <EmptyRow icon={Building2}>No confirmed hotel bookings</EmptyRow>
            ) : (
              topHotels.map((hotel) => (
                <div
                  key={hotel.name}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <IconChip icon={Building2} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{hotel.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {hotel.city} · <span className="tabular-nums">{hotel.bookings}</span> booking{hotel.bookings > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{money(hotel.revenue)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
  );
}

async function LeaderboardSection({
  leaderboardP,
  rangeQuery,
}: {
  leaderboardP: ReturnType<typeof getAgentLeaderboard>;
  rangeQuery: string;
}) {
  const leaderboard = await leaderboardP;
  return (
      <Card className={CARD}>
        <CardHeader>
          <CardTitle>Agent leaderboard</CardTitle>
          <CardAction>
            <ExportLink href={`/admin/reports/agent-leaderboard/export?${rangeQuery}`} />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {leaderboard.length === 0 ? (
            <EmptyRow icon={Users}>No agency bookings in this range</EmptyRow>
          ) : (
            leaderboard.map((agency, i) => (
              <div
                key={agency.name + i}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* Top three get the podium treatment so the ranking reads
                      instantly instead of requiring a left-to-right scan. */}
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                      i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <p className="truncate text-sm font-medium">{agency.name}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-sm sm:flex-row sm:items-center sm:gap-4">
                  <span className="text-xs text-muted-foreground tabular-nums sm:text-sm">{agency.orders} orders</span>
                  <span className="font-semibold tabular-nums">{money(agency.revenue)}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
  );
}

async function VisaSection({
  visaStatsP,
  upcomingHallsP,
}: {
  visaStatsP: ReturnType<typeof getVisaStatsAdmin>;
  upcomingHallsP: ReturnType<typeof getUpcomingHallBookings>;
}) {
  const [visaStats, upcomingHalls] = await Promise.all([visaStatsP, upcomingHallsP]);
  const visaActive =
    (visaStats.byStatus["submitted"] ?? 0) +
    (visaStats.byStatus["in_review"] ?? 0) +
    (visaStats.byStatus["additional_info_required"] ?? 0) +
    (visaStats.byStatus["ready_for_processing"] ?? 0) +
    (visaStats.byStatus["processing"] ?? 0);
  return (
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className={cn(CARD, "lg:col-span-3")}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Visa pipeline
              <Badge variant="neutral" className="tabular-nums">
                {visaActive} active · {visaStats.total} total
              </Badge>
            </CardTitle>
            <CardAction>
              <Button size="sm" variant="outline" render={<Link href="/admin/visa" />}>
                Review
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {VISA_PIPELINE_STAGES.filter((status) => (visaStats.byStatus[status] ?? 0) > 0).map((status) => (
              <Link
                key={status}
                href={`/admin/visa?queue=${VISA_STAGE_QUEUE[status] ?? "all"}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <IconChip icon={VISA_STAGE_ICON[status]} tone={VISA_STAGE_TONE[status]} />
                  <p className="truncate text-sm font-medium">{VISA_STAGE_LABELS[status as VisaStage]}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{visaStats.byStatus[status]}</span>
              </Link>
            ))}
            {visaStats.total === 0 ? <EmptyRow icon={FileText}>No visa applications</EmptyRow> : null}
          </CardContent>
        </Card>

        <Card className={cn(CARD, "lg:col-span-2")}>
          <CardHeader>
            <CardTitle>Upcoming events</CardTitle>
            <CardAction>
              <Button size="sm" variant="outline" render={<Link href="/admin/events" />}>
                Manage
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {upcomingHalls.length === 0 ? (
              <EmptyRow icon={PartyPopper}>No upcoming hall bookings</EmptyRow>
            ) : (
              upcomingHalls.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <IconChip icon={PartyPopper} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize">
                        {humanize(booking.event_type)} · {booking.venue?.name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {shortDate(booking.start_date)}
                        {booking.end_date !== booking.start_date ? ` – ${shortDate(booking.end_date)}` : ""}
                        {booking.expected_guests ? ` · ${booking.expected_guests} guests` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusBadgeVariant(booking.status)} className="shrink-0 capitalize">
                    {humanize(booking.status)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
  );
}

async function RolesSection({ statsP }: { statsP: ReturnType<typeof getDashboardStats> }) {
  const stats = await statsP;
  const usersByRoleData = Object.entries(ROLE_CHART_LABELS).map(([role, label]) => ({
    role,
    label,
    count: stats.usersByRole[role] ?? 0,
  }));
  return (
      <Card className={CARD}>
        <CardHeader>
          <CardTitle>Users by role</CardTitle>
        </CardHeader>
        <CardContent>
          <UsersByRoleChart data={usersByRoleData} />
        </CardContent>
      </Card>
  );
}

function EmptyRow({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Empty>
      <EmptyMedia variant="icon">
        <Icon />
      </EmptyMedia>
      <EmptyTitle>{children}</EmptyTitle>
    </Empty>
  );
}

function IconChip({ icon: Icon, tone = "neutral" }: { icon: LucideIcon; tone?: Tone }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONES[tone])} aria-hidden="true">
      <Icon className="size-4" />
    </span>
  );
}

function ExportLink({ href }: { href: string }) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Export CSV"
      title="Export CSV"
      nativeButton={false}
      render={<a href={href} />}
    >
      <Download aria-hidden="true" />
    </Button>
  );
}

/** Direction arrow carries the meaning alongside color, so the trend still reads without color vision. */
function DeltaPill({ change }: { change: number }) {
  const positive = change >= 0;
  const Arrow = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        positive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
      )}
    >
      <Arrow className="size-3" />
      {Math.abs(change)}%<span className="sr-only"> versus the prior period</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  change,
  series,
  href,
}: {
  label: string;
  value: string | number;
  change?: number | null;
  series?: number[];
  /** Makes the whole card a link to the underlying records — e.g. the users table, the filtered order list. */
  href?: string;
}) {
  const positive = (change ?? 0) >= 0;
  const body = (
    <Card className={cn(CARD, "h-full", href && "transition-shadow group-hover:shadow-md")}>
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-xs leading-tight font-medium text-muted-foreground">{label}</p>
          {change !== null && change !== undefined ? <DeltaPill change={change} /> : null}
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="min-w-0 font-heading text-xl leading-tight font-semibold tracking-tight break-words tabular-nums sm:text-[26px]">
            {value}
          </p>
          {series && series.length > 1 && String(value).length <= 6 ? (
            <span className="hidden shrink-0 2xl:block">
              <Sparkline data={series} positive={positive} />
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} aria-label={label} className="group block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
