import { format } from "date-fns";
import { CalendarDays, Download, Globe2, Building2, HandCoins } from "lucide-react";
import { REPORT_RANGES, getHotelReport, resolveRange } from "@/modules/hotels/report-queries";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { HotelMetric, HotelWorkspaceHeader, hotelStyles as styles } from "@/modules/hotels/components/hotel-workspace";
import { HotelOccupancyChart } from "@/modules/hotels/components/hotel-occupancy-chart";
import { cn } from "@/lib/utils";

const CHANNELS = {
  online: { label: "Online", color: "var(--primary)", icon: Globe2 },
  agency: { label: "Agency", color: "var(--chart-3)", icon: Building2 },
  offline: { label: "Offline", color: "var(--chart-4)", icon: HandCoins },
} as const;

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function percent(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

export async function ReportsView({ hotelId, base, range: rangeParam }: { hotelId: string; base: string; range?: string }) {
  const range = resolveRange(rangeParam);
  const report = await getHotelReport(hotelId, range.from, range.to);
  const { kpis } = report;
  const totalBookings = report.byChannel.reduce((sum, channel) => sum + channel.bookings, 0);
  const circumference = 2 * Math.PI * 46;
  const largestRevenue = Math.max(1, ...report.byRoom.map((room) => room.revenue));

  return (
    <div className={styles.workspace}>
      <HotelWorkspaceHeader title="Performance reports" eyebrow="Property intelligence"
        meta={<span className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground tabular-nums"><CalendarDays className="size-3.5" aria-hidden="true" />
          {format(new Date(`${range.from}T00:00:00`), "d MMM")} – {format(new Date(`${range.to}T00:00:00`), "d MMM yyyy")}
        </span>}
        actions={<Button variant="outline" render={<a href={`${base}/reports/export?range=${range.key}`} />}><Download aria-hidden="true" />Export CSV</Button>}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips label="Report range" active={range.key} items={REPORT_RANGES.map((r) => ({ key: r.key, label: r.label, href: `${base}/reports?range=${r.key}` }))}
          className="[&_a]:rounded-lg [&_a]:border-transparent [&_a[aria-current=page]]:border-border [&_a[aria-current=page]]:bg-card [&_a[aria-current=page]]:text-foreground [&_a[aria-current=page]]:shadow-xs" />
        <span className="text-xs text-muted-foreground">Arrival date · {report.currency}</span>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HotelMetric label="Total revenue" value={money(report.currency, kpis.revenue)} detail={`${kpis.stays} confirmed ${kpis.stays === 1 ? "stay" : "stays"}`} featured />
        <HotelMetric label="Occupancy" value={percent(kpis.occupancyPct)} detail={`${kpis.roomNights} room nights`} />
        <HotelMetric label="Average nightly rate" value={kpis.adr === null ? "—" : money(report.currency, kpis.adr)} />
        <HotelMetric label="Total bookings" value={kpis.bookings} detail={`${percent(kpis.cancellationRate)} cancellations · ${kpis.noShows} no-shows`} />
      </dl>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className={styles.surface} aria-labelledby="occupancy-heading">
          <div className={styles.sectionHeading}>
            <h2 id="occupancy-heading">Occupancy by night</h2>
            <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">{report.daily.length} nights</span>
          </div>
          <HotelOccupancyChart daily={report.daily} />
        </section>
        <section className={styles.surface} aria-labelledby="channels-heading">
          <div className={styles.sectionHeading}><h2 id="channels-heading">Booking channels</h2><span className="text-xs text-muted-foreground">By bookings</span></div>
          <div className="flex items-center justify-center py-5">
            <div className="relative size-36">
              <svg viewBox="0 0 112 112" className="size-full -rotate-90" aria-hidden="true">
                <circle cx="56" cy="56" r="46" fill="none" stroke="var(--secondary)" strokeWidth="10" />
                {report.byChannel.map((channel, index) => {
                  const length = totalBookings > 0 ? (channel.bookings / totalBookings) * circumference : 0;
                  const offset = totalBookings > 0 ? report.byChannel.slice(0, index).reduce((sum, previous) => sum + previous.bookings, 0) / totalBookings * circumference : 0;
                  return <circle key={channel.channel} cx="56" cy="56" r="46" fill="none" stroke={CHANNELS[channel.channel].color} strokeWidth="10" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} />;
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-heading text-3xl font-semibold tabular-nums">{totalBookings}</span><span className="mt-1 text-[11px] text-muted-foreground">Bookings</span></div>
            </div>
          </div>
          <ul className="divide-y divide-border px-5 pb-2">
            {report.byChannel.map((channel) => {
              const { label, icon: Icon, color } = CHANNELS[channel.channel];
              const share = totalBookings > 0 ? Math.round((channel.bookings / totalBookings) * 100) : 0;
              return (
                <li key={channel.channel} className="flex items-center gap-3 py-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-secondary"><Icon className="size-3.5" style={{ color }} aria-hidden="true" /></span>
                  <div className="flex-1"><div className="text-xs font-medium">{label}<span className="ml-2 text-[11px] font-normal text-muted-foreground tabular-nums">{share}%</span></div><div className="mt-0.5 text-[11px] text-muted-foreground">{channel.bookings} {channel.bookings === 1 ? "booking" : "bookings"}</div></div>
                  <span className="text-xs font-semibold tabular-nums">{money(report.currency, channel.revenue)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className={styles.surface} aria-labelledby="room-performance-heading">
        <div className={styles.sectionHeading}><h2 id="room-performance-heading">Room performance</h2><span className="text-xs text-muted-foreground">{report.byRoom.length} room types</span></div>
        <Table>
          <TableHeader><TableRow className="bg-secondary/40 hover:bg-secondary/40">
            <TableHead className="pl-6">Room type</TableHead><TableHead numeric>Stays</TableHead><TableHead numeric>Room nights</TableHead><TableHead numeric>Avg. rate</TableHead><TableHead numeric>Occupancy</TableHead><TableHead numeric className="pr-6">Revenue</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {report.byRoom.map((room, index) => (
              <TableRow key={room.roomId}>
                <TableCell className="py-4 pl-6"><div className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-[11px] font-semibold text-muted-foreground tabular-nums">{String(index + 1).padStart(2, "0")}</span><span className="font-medium">{room.name}</span></div></TableCell>
                <TableCell numeric>{room.stays}</TableCell><TableCell numeric>{room.roomNights}</TableCell><TableCell numeric>{room.adr === null ? "—" : Math.round(room.adr).toLocaleString("en-US")}</TableCell>
                <TableCell numeric><span className="inline-flex items-center gap-2"><span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-secondary sm:block"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, room.occupancyPct ?? 0))}%` }} /></span>{percent(room.occupancyPct)}</span></TableCell>
                <TableCell numeric className="min-w-32 pr-6"><div className="ml-auto w-fit"><span className={cn("font-semibold", room.revenue > 0 && "text-primary")}>{money(report.currency, room.revenue)}</span><span className="mt-1.5 block h-0.5 rounded-full bg-primary/15"><span className="block h-full rounded-full bg-primary" style={{ width: `${(room.revenue / largestRevenue) * 100}%` }} /></span></div></TableCell>
              </TableRow>
            ))}
            {report.byRoom.length === 0 ? <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No room types</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
