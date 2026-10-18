import { notFound } from "next/navigation";
import Link from "next/link";
import { BedDouble, Building2, CalendarCheck, ChevronLeft, ChevronRight, LogIn, LogOut, Wrench } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getFrontDeskBoard, getFrontDeskDayStats } from "@/modules/hotels/front-desk-queries";
import { FrontDeskGrid } from "@/modules/hotels/components/front-desk-grid";

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
  const tiles = [
    { label: "Arrivals", value: stats.arrivals, icon: LogIn, tone: "bg-primary/10 text-primary" },
    { label: "Departures", value: stats.departures, icon: LogOut, tone: "bg-destructive/10 text-destructive" },
    { label: "Occupied", value: stats.occupied, icon: BedDouble, tone: "bg-chart-4/10 text-chart-4" },
    { label: "Booked rooms", value: stats.totalBooked, icon: CalendarCheck, tone: "bg-chart-2/10 text-chart-2" },
    { label: "Total rooms", value: stats.totalRooms, icon: Building2, tone: "bg-secondary text-foreground" },
    { label: "Out of order", value: stats.outOfOrder, icon: Wrench, tone: "bg-muted text-muted-foreground" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Front Desk</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {board.unassignedCount > 0 ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-gold/15 px-3 text-xs font-semibold text-amber-700 dark:text-brand-gold">
              <span className="size-1.5 rounded-full bg-brand-gold" />
              {board.unassignedCount} unassigned
            </span>
          ) : null}

          <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5 shadow-sm">
            <Link
              href={prevHref}
              aria-label="Previous"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <Link
              href={`/manager/${hotelId}/front-desk?date=${todayIso()}&days=${days}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isToday ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {isToday ? `Today · ${shortDate}` : shortDate}
            </Link>
            <Link
              href={nextHref}
              aria-label="Next"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5 shadow-sm">
            {([7, 14] as const).map((d) => (
              <Link
                key={d}
                href={`/manager/${hotelId}/front-desk?date=${startDate}&days=${d}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${days === d ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                {d} days
              </Link>
            ))}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-foreground/10">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${s.tone}`}>
              <s.icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <dd className="font-heading text-2xl leading-none font-bold tabular-nums">{s.value}</dd>
              <dt className="mt-1 truncate text-xs text-muted-foreground">{s.label}</dt>
            </div>
          </div>
        ))}
      </dl>

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
