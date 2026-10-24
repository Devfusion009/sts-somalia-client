import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getFrontDeskBoard, getFrontDeskDayStats } from "@/modules/hotels/front-desk-queries";
import { FrontDeskGrid } from "@/modules/hotels/components/front-desk-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { cn } from "@/lib/utils";

export const metadata = { title: "Front Desk" };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function ManagerFrontDeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ date?: string; days?: string }>;
}) {
  const { hotelId } = await params;
  const { date, days: daysParam } = await searchParams;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed || !hasPermission(managed, "bookings")) notFound();

  const startDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso();
  const days = daysParam === "14" ? 14 : 7;

  const [board, stats] = await Promise.all([
    getFrontDeskBoard(hotelId, startDate, days),
    getFrontDeskDayStats(hotelId, startDate),
  ]);

  const prevHref = `/manager/${hotelId}/front-desk?date=${addDays(startDate, -days)}&days=${days}`;
  const nextHref = `/manager/${hotelId}/front-desk?date=${addDays(startDate, days)}&days=${days}`;
  const canEdit = hasPermission(managed, "bookings");

  const isToday = startDate === todayIso();
  const shortDate = new Date(`${startDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const base = `/manager/${hotelId}/front-desk`;
  const segment = "h-7 rounded-md px-2.5 text-xs font-medium tabular-nums text-muted-foreground transition-colors outline-none hover:bg-background/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:h-9 inline-flex items-center";
  const segmentOn = "bg-background text-foreground shadow-xs hover:bg-background";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Front Desk"
        status={
          board.unassignedCount > 0 ? (
            <Badge variant="warning" className="tabular-nums">
              {board.unassignedCount} unassigned
            </Badge>
          ) : null
        }
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label={`Previous ${days} days`} render={<Link href={prevHref} />}>
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                variant={isToday ? "secondary" : "outline"}
                className="tabular-nums"
                aria-current={isToday ? "date" : undefined}
                render={<Link href={`${base}?date=${todayIso()}&days=${days}`} />}
              >
                {isToday ? `Today · ${shortDate}` : shortDate}
              </Button>
              <Button variant="outline" size="icon" aria-label={`Next ${days} days`} render={<Link href={nextHref} />}>
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
            <div role="group" aria-label="Days shown" className="flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
              {([7, 14] as const).map((d) => (
                <Link
                  key={d}
                  href={`${base}?date=${startDate}&days=${d}`}
                  aria-current={days === d ? "true" : undefined}
                  className={cn(segment, days === d && segmentOn)}
                >
                  {d} days
                </Link>
              ))}
            </div>
          </>
        }
      />

      <StatRail className="sm:grid-cols-3 lg:grid-cols-6">
        <StatRailItem label="Arrivals" value={stats.arrivals} />
        <StatRailItem label="Departures" value={stats.departures} />
        <StatRailItem label="Occupied" value={stats.occupied} />
        <StatRailItem label="Booked rooms" value={stats.totalBooked} />
        <StatRailItem label="Total rooms" value={stats.totalRooms} />
        <StatRailItem
          label="Out of order"
          value={stats.outOfOrder}
          tone={stats.outOfOrder > 0 ? "destructive" : undefined}
        />
      </StatRail>

      <FrontDeskGrid
        hotelId={hotelId}
        roomTypes={board.roomTypes}
        bars={Object.fromEntries(board.barsByUnit)}
        disabledRanges={board.disabledRanges}
        dateList={board.dateList}
        canEdit={canEdit}
      />
    </div>
  );
}
