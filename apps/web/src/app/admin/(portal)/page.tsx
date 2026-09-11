import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Users,
  ShoppingCart,
  DollarSign,
  ClipboardCheck,
  Building2,
  Plane,
  FileText,
  Landmark,
  PartyPopper,
  Download,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  BellRing,
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
import { Badge } from "@/components/ui/badge";
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
import { VISA_STATUS_LABELS } from "@/modules/visa/schemas";
import { RevenueTrendChart } from "@/modules/admin/components/revenue-trend-chart";
import { BookingsByTypeChart } from "@/modules/admin/components/bookings-by-type-chart";
import { UsersByRoleChart } from "@/modules/admin/components/users-by-role-chart";
import { UserGrowthChart } from "@/modules/admin/components/user-growth-chart";
import { B2BvsB2CChart } from "@/modules/admin/components/b2b-b2c-chart";
import { Sparkline } from "@/components/dashboard/sparkline";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { resolveDateRange, percentChange } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth/session";

// Deliberately plural and separate from ROLE_LABELS in lib/auth/roles.ts:
// these name chart series ("Agents"), not an individual's role ("Travel
// Agent"). Typed over AppRole so adding an enum value fails to compile here
// rather than quietly dropping a slice from the users-by-role chart.
const ROLE_CHART_LABELS: Record<AppRole, string> = {
  customer: "Customers",
  agent: "Agents",
  hotel_partner: "Hotel Partners",
  hotel_manager: "Hotel Managers",
  affiliate: "Affiliates",
  venue_partner: "Venue Partners",
  admin: "Admins",
};

/**
 * Per-vertical accent, reused for both the stat cards and the row icons in
 * the lists below so a hotel always reads teal, a flight always violet, etc.
 * Tints are the /10 of an existing chart token — no new colors introduced.
 */
const TONES = {
  teal: "bg-primary/10 text-primary",
  orange: "bg-brand-accent/10 text-brand-accent",
  blue: "bg-chart-3/10 text-chart-3",
  violet: "bg-chart-4/10 text-chart-4",
  gold: "bg-brand-gold/10 text-brand-gold",
  red: "bg-destructive/10 text-destructive",
  // Same visual language as VisaStatusBadge's own ready_for_processing tint.
  cyan: "bg-chart-2/10 text-chart-2",
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

const ITEM_TYPE_TONE: Record<string, Tone> = {
  hotel: "teal",
  flight: "violet",
  visa: "blue",
  umrah: "gold",
  hall: "orange",
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
  submitted: "blue",
  in_review: "violet",
  additional_info_required: "orange",
  ready_for_processing: "cyan",
  processing: "gold",
  approved: "teal",
  issued: "teal",
  rejected: "red",
  cancelled: "red",
};

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

  const [
    stats,
    revenueTrend,
    bookingsByType,
    recentOrders,
    topHotels,
    visaStats,
    upcomingHalls,
    userGrowth,
    b2bVsB2c,
    leaderboard,
    statTrends,
  ] = await Promise.all([
    getDashboardStats(),
    getRevenueTrendRanged(range.from, range.to, range.granularity),
    getBookingsByTypeRanged(range.from, range.to),
    getRecentOrdersWithItems(6),
    getTopHotels(5),
    getVisaStatsAdmin(),
    getUpcomingHallBookings(5),
    getUserGrowth(range.from, range.to, range.granularity),
    getB2BvsB2C(range.from, range.to),
    getAgentLeaderboard(range.from, range.to, 10),
    getStatCardTrends(range.from, range.to, range.previousFrom, range.previousTo, range.granularity),
  ]);

  const visaActive =
    (visaStats.byStatus["submitted"] ?? 0) +
    (visaStats.byStatus["in_review"] ?? 0) +
    (visaStats.byStatus["additional_info_required"] ?? 0) +
    (visaStats.byStatus["ready_for_processing"] ?? 0) +
    (visaStats.byStatus["processing"] ?? 0);

  const usersByRoleData = Object.entries(ROLE_CHART_LABELS).map(([role, label]) => ({
    role,
    label,
    count: stats.usersByRole[role] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <DateRangePicker currentKey={range.key} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Users}
          tone="blue"
          label="Total users"
          value={stats.totalUsers}
          change={percentChange(statTrends.users.current, statTrends.users.previous)}
          series={statTrends.users.series}
          href="/admin/users"
        />
        <StatCard
          icon={ShoppingCart}
          tone="orange"
          label="Total orders"
          value={stats.totalOrders}
          change={percentChange(statTrends.orders.current, statTrends.orders.previous)}
          series={statTrends.orders.series}
          href="/admin/orders"
        />
        <StatCard
          icon={DollarSign}
          tone="teal"
          label="Paid revenue"
          value={`$${stats.revenue.toFixed(0)}`}
          change={percentChange(statTrends.revenue.current, statTrends.revenue.previous)}
          series={statTrends.revenue.series}
          href="/admin/orders?filter=paid"
        />
        <StatCard
          icon={ClipboardCheck}
          tone="violet"
          label="Pending applications"
          value={stats.pendingApplications}
          href="/admin/applications?status=pending"
        />
      </div>

      {stats.pendingApplications > 0 ? (
        <Card className={cn(CARD, "bg-primary/5 ring-primary/20")}>
          <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BellRing className="size-4" />
              </span>
              <p className="text-sm font-medium">
                {stats.pendingApplications} application{stats.pendingApplications > 1 ? "s" : ""} waiting for review
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {stats.pendingAgency} agency, {stats.pendingPartner} partner, {stats.pendingVenue} venue, {stats.pendingAffiliate} affiliate
                </span>
              </p>
            </div>
            <Button size="sm" className="shrink-0" render={<Link href="/admin/applications" />}>
              Review now
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
              <EmptyRow>No orders yet.</EmptyRow>
            ) : (
              recentOrders.map((order) => {
                const firstType = order.order_items[0]?.item_type;
                const Icon = firstType ? ITEM_TYPE_ICON[firstType] : ShoppingCart;
                const tone = (firstType && ITEM_TYPE_TONE[firstType]) || "teal";
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <IconChip icon={Icon} tone={tone} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{order.customer?.full_name ?? "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {order.order_number} · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">
                        {order.currency} {Number(order.total).toFixed(0)}
                      </span>
                      <Badge variant="secondary" className="capitalize">
                        {order.status.replace("_", " ")}
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
              <EmptyRow>No confirmed bookings yet.</EmptyRow>
            ) : (
              topHotels.map((hotel) => (
                <div
                  key={hotel.name}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <IconChip icon={Building2} tone="teal" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{hotel.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {hotel.city} · {hotel.bookings} booking{hotel.bookings > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">${hotel.revenue.toFixed(0)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={CARD}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-brand-gold" /> Agent leaderboard
          </CardTitle>
          <CardAction>
            <ExportLink href={`/admin/reports/agent-leaderboard/export?${rangeQuery}`} />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {leaderboard.length === 0 ? (
            <EmptyRow>No agency bookings in this range yet.</EmptyRow>
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
                      i === 0
                        ? "bg-brand-gold/15 text-brand-gold"
                        : i < 3
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <p className="truncate text-sm font-medium">{agency.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-sm">
                  <span className="text-muted-foreground tabular-nums">{agency.orders} orders</span>
                  <span className="font-semibold tabular-nums">${agency.revenue.toFixed(0)}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className={cn(CARD, "lg:col-span-3")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Visa pipeline
              <Badge variant="secondary">
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
                href={`/admin/visa?status=${status}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <IconChip icon={VISA_STAGE_ICON[status]} tone={VISA_STAGE_TONE[status]} />
                  <p className="truncate text-sm font-medium">{VISA_STATUS_LABELS[status]}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{visaStats.byStatus[status]}</span>
              </Link>
            ))}
            {visaStats.total === 0 ? <EmptyRow>No visa applications yet.</EmptyRow> : null}
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
              <EmptyRow>No upcoming hall bookings.</EmptyRow>
            ) : (
              upcomingHalls.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <IconChip icon={PartyPopper} tone="orange" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize">
                        {booking.event_type.replace("_", " ")} · {booking.venue?.name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(booking.start_date).toLocaleDateString()}
                        {booking.end_date !== booking.start_date
                          ? ` → ${new Date(booking.end_date).toLocaleDateString()}`
                          : ""}
                        {booking.expected_guests ? ` · ${booking.expected_guests} guests` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {booking.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={CARD}>
        <CardHeader>
          <CardTitle>Users by role</CardTitle>
        </CardHeader>
        <CardContent>
          <UsersByRoleChart data={usersByRoleData} />
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function IconChip({ icon: Icon, tone }: { icon: LucideIcon; tone: Tone }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>
      <Icon className="size-4" />
    </span>
  );
}

function ExportLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
    >
      <Download className="size-3.5" /> Export CSV
    </a>
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
  icon: Icon,
  tone,
  label,
  value,
  change,
  series,
  href,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: string | number;
  change?: number | null;
  series?: number[];
  /** Where "View all" takes the admin to review the underlying records — e.g. the users table, the filtered order list. Omit to render the card without the link. */
  href?: string;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <Card className={CARD}>
      {/* Two right-aligned slots stacked down the card: the delta pill sits
          with the label, the sparkline with the value it summarises. "View
          all" is a third row rather than crowding either of those. */}
      <CardContent className="flex flex-1 flex-col justify-between gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <IconChip icon={Icon} tone={tone} />
            <p className="text-xs leading-tight font-medium text-muted-foreground">{label}</p>
          </div>
          {change !== null && change !== undefined ? <DeltaPill change={change} /> : null}
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="font-heading text-[26px] leading-none font-bold tracking-tight tabular-nums">{value}</p>
          {series && series.length > 1 ? <Sparkline data={series} positive={positive} /> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
