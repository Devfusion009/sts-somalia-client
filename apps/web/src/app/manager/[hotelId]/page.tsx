import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format } from "date-fns";
import {
  ArrowRight,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Pencil,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyManagedHotel,
  hasPermission,
} from "@/modules/hotels/manager-queries";
import {
  getHotelFrontDesk,
  getPartnerStats,
  getRecentPartnerBookings,
  getWeekForecast,
} from "@/modules/hotels/partner-queries";
import { todayIso } from "@/modules/hotels/availability";
import { hotelGuestNames } from "@/modules/orders/format";
import { FrontDeskList } from "@/modules/hotels/components/front-desk-list";
import { OccupancyDonut } from "@/modules/hotels/components/occupancy-donut";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const INSIGHT_TIER = {
  low: {
    className: "border-destructive/30 bg-destructive/5",
    message:
      "Occupancy is low this week. Review pricing for these dates to attract more bookings.",
  },
  medium: {
    className: "border-brand-gold/30 bg-brand-gold/5",
    message:
      "Occupancy is moderate this week. A short-term rate adjustment could fill the remaining rooms.",
  },
  high: {
    className: "border-primary/30 bg-primary/5",
    message:
      "Occupancy is high this week. Confirm any pending requests before rooms sell out.",
  },
} as const;

function occupancyTier(pct: number): keyof typeof INSIGHT_TIER {
  if (pct >= 70) return "high";
  if (pct >= 40) return "medium";
  return "low";
}

const HOTEL_STATUS_BADGE: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

const BOOKING_STATUS_BADGE: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "bg-brand-gold/15 text-brand-gold",
  cancelled: "bg-destructive/10 text-destructive",
  completed: "bg-muted text-muted-foreground",
};

function GuestList({
  title,
  emptyLabel,
  bookings,
}: {
  title: string;
  emptyLabel: string;
  bookings: Array<{
    id: string;
    check_in: string;
    check_out: string;
    guest_details: unknown;
    hotel_rooms: { name: string } | null;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          <Badge variant="secondary">{bookings.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="divide-y divide-border">
            {bookings.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {hotelGuestNames(b.guest_details)[0] ?? "Guest"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.hotel_rooms?.name}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {b.check_in} → {b.check_out}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function ManagerDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { hotelId } = await params;
  const { week } = await searchParams;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed) notFound();

  const weekStart =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : todayIso();
  const weekStartDate = new Date(`${weekStart}T00:00:00Z`);
  const weekEndDate = addDays(weekStartDate, 6);
  const prevWeek = format(addDays(weekStartDate, -7), "yyyy-MM-dd");
  const nextWeek = format(addDays(weekStartDate, 7), "yyyy-MM-dd");

  const [frontDesk, stats, recent, forecast] = await Promise.all([
    getHotelFrontDesk(hotelId, [hotelId]),
    getPartnerStats([hotelId]),
    getRecentPartnerBookings([hotelId]),
    getWeekForecast(hotelId, weekStart),
  ]);

  const canEditBookings = hasPermission(managed, "bookings");
  const insight = INSIGHT_TIER[occupancyTier(forecast.occupancyPct)];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-heading text-2xl font-semibold">
            {managed.hotel.name}
          </h1>
          <Badge
            className={cn(
              "border-transparent capitalize",
              HOTEL_STATUS_BADGE[managed.hotel.status] ??
                "bg-muted text-muted-foreground",
            )}
          >
            {managed.hotel.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {managed.hotel.city}, {managed.hotel.country_code}
        </p>
      </div>

      {canEditBookings ? (
        <Link
          href={`/manager/${hotelId}/bookings/new`}
          className="flex items-center gap-3 rounded-xl bg-primary px-5 py-4 text-primary-foreground transition-opacity hover:opacity-90"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-foreground/15">
            <CalendarPlus className="size-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold">
            Record offline booking
          </span>
          <ArrowRight className="size-4.5 shrink-0" />
        </Link>
      ) : null}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        {[
          { label: "In house", value: frontDesk.inHouse.length },
          { label: "Arriving today", value: frontDesk.arrivingToday.length },
          { label: "Departing today", value: frontDesk.departingToday.length },
          { label: "Pending bookings", value: stats.pendingCount },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary/40 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-heading text-xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FrontDeskList
            title="Arriving today"
            emptyLabel="No arrivals today."
            bookings={frontDesk.arrivingToday}
            mode="arriving"
            canEdit={canEditBookings}
          />
          <FrontDeskList
            title="Departing today"
            emptyLabel="No departures today."
            bookings={frontDesk.departingToday}
            mode="departing"
            canEdit={canEditBookings}
          />
          <GuestList
            title="In house"
            emptyLabel="No guests in house."
            bookings={frontDesk.inHouse}
          />
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Forecast</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                render={<Link href={`?week=${prevWeek}`} />}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                render={<Link href={`?week=${nextWeek}`} />}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-xs text-muted-foreground">
              {format(weekStartDate, "EEE d MMM")} –{" "}
              {format(weekEndDate, "EEE d MMM")}
            </p>

            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Occupancy</dt>
                <dd className="font-heading text-lg font-semibold">
                  {forecast.occupancyPct}%
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Arrivals</dt>
                <dd className="font-heading text-lg font-semibold">
                  {forecast.arrivals}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Nights booked</dt>
                <dd className="font-heading text-lg font-semibold">
                  {forecast.bookedNights}/{forecast.capacityNights}
                </dd>
              </div>
            </dl>

            <OccupancyDonut
              booked={forecast.bookedNights}
              capacity={forecast.capacityNights}
            />

            <div
              className={cn(
                "space-y-2 rounded-lg border p-3",
                insight.className,
              )}
            >
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Lightbulb className="size-4" /> Insight
              </p>
              <p className="text-sm text-muted-foreground">{insight.message}</p>
              {canEditBookings ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  render={<Link href={`/manager/${hotelId}/rooms`} />}
                >
                  <Pencil className="size-3.5" /> Adjust room pricing
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent bookings</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-primary"
            render={<Link href={`/manager/${hotelId}/bookings`} />}
          >
            View all <ArrowRight className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {b.hotel_rooms?.name ?? "Room"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.check_in} → {b.check_out} · booked{" "}
                      {format(new Date(b.created_at), "dd MMM")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium">
                      {b.currency} {Number(b.total_price).toFixed(0)}
                    </span>
                    <Badge
                      className={cn(
                        "border-transparent capitalize",
                        BOOKING_STATUS_BADGE[b.status] ??
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {b.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
