import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getFrontDeskBoard, getFrontDeskDayStats } from "@/modules/hotels/front-desk-queries";
import { FrontDeskGrid } from "@/modules/hotels/components/front-desk-grid";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Front Desk</h1>
        <div className="flex items-center gap-2">
          {([7, 14] as const).map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              render={<Link href={`/manager/${hotelId}/front-desk?date=${startDate}&days=${d}`} />}
            >
              {d} days
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="icon" variant="outline" className="size-8" render={<Link href={prevHref} />}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold">
          {new Date(`${startDate}T00:00:00Z`).toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
        <Button size="icon" variant="outline" className="size-8" render={<Link href={nextHref} />}>
          <ChevronRight className="size-4" />
        </Button>

        <div className="ml-2 flex flex-wrap items-center gap-2">
          {[
            { label: "Arrivals", value: stats.arrivals, tone: "text-primary" },
            { label: "Departures", value: stats.departures, tone: "text-destructive" },
            { label: "Occupied", value: stats.occupied, tone: "text-chart-4" },
            { label: "Total Rooms", value: stats.totalRooms, tone: "text-foreground" },
            { label: "Booked Rooms", value: stats.totalBooked, tone: "text-foreground" },
            { label: "Out of Order", value: stats.outOfOrder, tone: "text-muted-foreground" },
          ].map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium">
              {s.label} <span className={`font-heading text-sm font-bold ${s.tone}`}>{s.value}</span>
            </span>
          ))}
        </div>
      </div>

      {board.unassignedCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {board.unassignedCount} booking{board.unassignedCount === 1 ? "" : "s"} not yet assigned to a room — not shown on the grid below.
        </p>
      ) : null}

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
