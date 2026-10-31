import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, format } from "date-fns";
import { ArrowRight, BedDouble, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, ReceiptText, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import {
  getHotelFrontDesk,
  getPartnerStats,
  getRecentPartnerBookings,
  getWeekForecast,
} from "@/modules/hotels/partner-queries";
import { todayIso } from "@/modules/hotels/availability";
import { getTodayCounts } from "@/modules/hotels/booking-detail-queries";
import { hotelGuestNames } from "@/modules/orders/format";
import { FrontDeskList } from "@/modules/hotels/components/front-desk-list";
import { OccupancyDonut } from "@/components/dashboard/lazy-charts";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { dateSpan, money } from "@/lib/money";
import { WorkspaceCover } from "@/components/portal/workspace-cover";
import { hotelImageUrls } from "@/modules/hotels/images";
import styles from "../workspace.module.css";

function GuestList({
  title,
  bookings,
}: {
  title: string;
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
          <Badge variant="secondary" className="tabular-nums">
            {bookings.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <BedDouble />
            </EmptyMedia>
            <EmptyTitle>No guests in house</EmptyTitle>
          </Empty>
        ) : (
          <ul className="divide-y divide-border">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{hotelGuestNames(b.guest_details)[0] ?? "Guest"}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.hotel_rooms?.name}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground tabular-nums">{dateSpan(b.check_in, b.check_out)}</p>
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

  const [frontDesk, stats, recent, forecast, today] = await Promise.all([
    getHotelFrontDesk(hotelId, [hotelId]),
    getPartnerStats([hotelId]),
    getRecentPartnerBookings([hotelId]),
    getWeekForecast(hotelId, weekStart),
    getTodayCounts(hotelId, todayIso()),
  ]);

  const canEditBookings = hasPermission(managed, "bookings");
  const base = `/manager/${hotelId}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-5">
        <WorkspaceCover
          image={hotelImageUrls(managed.hotel.images)[0] ?? "/marketing/hotels-hero-bg.webp"}
          title={managed.hotel.name}
          status={<Badge variant={statusBadgeVariant(managed.hotel.status)} className="capitalize">{managed.hotel.status.replace(/_/g, " ")}</Badge>}
          meta={<span>{managed.hotel.city}, {managed.hotel.country_code}{profile.manager_code ? ` · ${profile.manager_code}` : ""}</span>}
          actions={canEditBookings ? <Button render={<Link href={`${base}/bookings/new`} />}><CalendarPlus aria-hidden="true" />New reservation</Button> : undefined}
        />

        <StatRail className={styles.stats}>
          <StatRailItem label="In house" value={frontDesk.inHouse.length} />
          <StatRailItem label="Arriving today" value={frontDesk.arrivingToday.length} />
          <StatRailItem label="Departing today" value={frontDesk.departingToday.length} />
          <StatRailItem
            label="Pending bookings"
            value={stats.pendingCount}
            tone={stats.pendingCount > 0 ? "warn" : undefined}
          />
        </StatRail>
        <dl className={styles.daily}>
          <div><dt>New today</dt><dd>{today.newToday}</dd></div>
          <div><dt>Checked out</dt><dd>{today.checkedOutToday}</dd></div>
          <div><dt>Cancelled</dt><dd>{today.cancelledToday}</dd></div>
          <div><dt>No-shows</dt><dd>{today.noShowToday}</dd></div>
        </dl>
        <nav aria-label="Property operations" className={styles.shortcuts}>
          <Link href={`${base}/bookings`} className={styles.shortcut}><Ticket className="size-4" aria-hidden="true" />Reservations<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
          {canEditBookings ? <Link href={`${base}/front-desk`} className={styles.shortcut}><CalendarDays className="size-4" aria-hidden="true" />Front desk<ArrowRight className="size-3.5" aria-hidden="true" /></Link> : null}
          {hasPermission(managed, "rooms") || hasPermission(managed, "availability") ? <Link href={`${base}/rooms`} className={styles.shortcut}><BedDouble className="size-4" aria-hidden="true" />Rooms & availability<ArrowRight className="size-3.5" aria-hidden="true" /></Link> : null}
        </nav>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <FrontDeskList
            title="Arriving today"
            emptyLabel="No arrivals today"
            bookings={frontDesk.arrivingToday}
            mode="arriving"
            canEdit={canEditBookings}
          />
          <FrontDeskList
            title="Departing today"
            emptyLabel="No departures today"
            bookings={frontDesk.departingToday}
            mode="departing"
            canEdit={canEditBookings}
          />
          <GuestList title="In house" bookings={frontDesk.inHouse} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forecast</CardTitle>
            <CardAction className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous week"
                render={<Link href={`?week=${prevWeek}`} />}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next week"
                render={<Link href={`?week=${nextWeek}`} />}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            <time dateTime={weekStart} className="block text-xs text-muted-foreground tabular-nums">{format(weekStartDate, "d MMM")} – {format(weekEndDate, "d MMM yyyy")}</time>
            <dl className="grid grid-cols-3 divide-x divide-border text-center">
              <div className="px-2">
                <dt className="text-xs text-muted-foreground">Occupancy</dt>
                <dd className="font-heading text-lg font-semibold tabular-nums">{forecast.occupancyPct}%</dd>
              </div>
              <div className="px-2">
                <dt className="text-xs text-muted-foreground">Arrivals</dt>
                <dd className="font-heading text-lg font-semibold tabular-nums">{forecast.arrivals}</dd>
              </div>
              <div className="px-2">
                <dt className="text-xs text-muted-foreground">Room nights</dt>
                <dd className="font-heading text-lg font-semibold tabular-nums">
                  {forecast.bookedNights}
                  <span className="text-sm font-normal text-muted-foreground">/{forecast.capacityNights}</span>
                </dd>
              </div>
            </dl>

            <OccupancyDonut booked={forecast.bookedNights} capacity={forecast.capacityNights} />

            {hasPermission(managed, "rooms") ? (
              <Button variant="outline" className="w-full" render={<Link href={`${base}/rates`} />}>
                Manage rates
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent bookings</CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="All bookings"
              title="All bookings"
              render={<Link href={`${base}/bookings`} />}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <ReceiptText />
              </EmptyMedia>
              <EmptyTitle>No bookings</EmptyTitle>
            </Empty>
          ) : (
            <ul className="-mx-2 divide-y divide-border">
              {recent.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`${base}/bookings/${b.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.hotel_rooms?.name ?? "Room"}</p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {dateSpan(b.check_in, b.check_out)} · Booked {format(new Date(b.created_at), "d MMM")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className="text-sm font-medium tabular-nums">{money(b.total_price, b.currency)}</span>
                      <Badge variant={statusBadgeVariant(b.status)} className="capitalize">
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
