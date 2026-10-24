import { format } from "date-fns";
import { Download } from "lucide-react";
import { REPORT_RANGES, getHotelReport, resolveRange } from "@/modules/hotels/report-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { cn } from "@/lib/utils";

const CHANNEL_LABEL = { online: "Online", agency: "Agency", offline: "Offline" } as const;

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
  const peak = Math.max(1, ...report.daily.map((d) => d.capacity));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Reports"
        meta={
          <span className="tabular-nums">
            Arrivals {format(new Date(`${range.from}T00:00:00`), "d MMM")} –{" "}
            {format(new Date(`${range.to}T00:00:00`), "d MMM yyyy")}
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="icon"
            aria-label="Export CSV"
            title="Export CSV"
            render={<a href={`${base}/reports/export?range=${range.key}`} />}
          >
            <Download />
          </Button>
        }
      />

      <FilterChips
        label="Report range"
        active={range.key}
        items={REPORT_RANGES.map((r) => ({ key: r.key, label: r.label, href: `${base}/reports?range=${r.key}` }))}
      />

      <StatRail className="lg:grid-cols-4">
        <StatRailItem label="Revenue" value={money(report.currency, kpis.revenue)} />
        <StatRailItem label="Bookings" value={kpis.bookings} />
        <StatRailItem label="Room nights" value={kpis.roomNights} />
        <StatRailItem label="Avg. nightly rate" value={kpis.adr === null ? "—" : money(report.currency, kpis.adr)} />
        <StatRailItem label="Occupancy" value={percent(kpis.occupancyPct)} />
        <StatRailItem label="Confirmed stays" value={kpis.stays} />
        <StatRailItem label="Cancellation rate" value={percent(kpis.cancellationRate)} />
        <StatRailItem label="No-shows" value={kpis.noShows} />
      </StatRail>

      {report.daily.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy by night</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-px overflow-x-auto">
              {report.daily.map((d) => {
                const occ = d.capacity > 0 ? Math.round((d.booked / d.capacity) * 100) : 0;
                return (
                  <div
                    key={d.date}
                    className="group flex h-full min-w-[6px] flex-1 flex-col justify-end"
                    title={`${format(new Date(`${d.date}T00:00:00`), "EEE d MMM")}: ${d.booked}/${d.capacity} rooms (${occ}%)`}
                  >
                    <div
                      className={cn("w-full rounded-t-sm", occ >= 70 ? "bg-primary" : occ >= 40 ? "bg-primary/50" : "bg-muted-foreground/40")}
                      style={{ height: `${Math.max(2, (d.booked / peak) * 100)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{format(new Date(`${report.daily[0].date}T00:00:00`), "d MMM")}</span>
              <span>{format(new Date(`${report.daily[report.daily.length - 1].date}T00:00:00`), "d MMM")}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden py-0 lg:col-span-2">
          <CardHeader className="border-b border-border pt-4 pb-3">
            <CardTitle className="text-base">Room types</CardTitle>
          </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room type</TableHead>
                  <TableHead numeric>Stays</TableHead>
                  <TableHead numeric>Room nights</TableHead>
                  <TableHead numeric>Avg. rate</TableHead>
                  <TableHead numeric>Occupancy</TableHead>
                  <TableHead numeric>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byRoom.map((r) => (
                  <TableRow key={r.roomId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell numeric>{r.stays}</TableCell>
                    <TableCell numeric>{r.roomNights}</TableCell>
                    <TableCell numeric>{r.adr === null ? "—" : Math.round(r.adr).toLocaleString("en-US")}</TableCell>
                    <TableCell numeric>{percent(r.occupancyPct)}</TableCell>
                    <TableCell numeric className="font-medium">{money(report.currency, r.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {report.byChannel.map((c) => (
                <li key={c.channel} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm font-medium">{CHANNEL_LABEL[c.channel]}</span>
                  <span className="text-right text-sm tabular-nums">
                    <span className="block font-medium">{money(report.currency, c.revenue)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.bookings} {c.bookings === 1 ? "booking" : "bookings"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
