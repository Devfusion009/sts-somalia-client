import Link from "next/link";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { REPORT_RANGES, getHotelReport, resolveRange } from "@/modules/hotels/report-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Reports</h1>
        <Button
          variant="outline"
          className="gap-1.5"
          render={<a href={`${base}/reports/export?range=${range.key}`} />}
        >
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Report range">
        {REPORT_RANGES.map((r) => (
          <Link
            key={r.key}
            href={`${base}/reports?range=${r.key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              r.key === range.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {r.label}
          </Link>
        ))}
        <span className="ml-1 self-center text-xs text-muted-foreground">
          Arrivals {format(new Date(`${range.from}T00:00:00`), "d MMM")} – {format(new Date(`${range.to}T00:00:00`), "d MMM yyyy")}
        </span>
      </nav>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        {[
          { label: "Revenue", value: money(report.currency, kpis.revenue) },
          { label: "Bookings", value: kpis.bookings },
          { label: "Room nights", value: kpis.roomNights },
          { label: "Avg. nightly rate", value: kpis.adr === null ? "—" : money(report.currency, kpis.adr) },
          { label: "Occupancy", value: percent(kpis.occupancyPct) },
          { label: "Confirmed stays", value: kpis.stays },
          { label: "Cancellation rate", value: percent(kpis.cancellationRate) },
          { label: "No-shows", value: kpis.noShows },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary/40 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-heading text-xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

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
                      className={cn("w-full rounded-t-sm", occ >= 70 ? "bg-primary" : occ >= 40 ? "bg-brand-gold" : "bg-muted-foreground/40")}
                      style={{ height: `${Math.max(2, (d.booked / peak) * 100)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{format(new Date(`${report.daily[0].date}T00:00:00`), "d MMM")}</span>
              <span>{format(new Date(`${report.daily[report.daily.length - 1].date}T00:00:00`), "d MMM")}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden py-0 lg:col-span-2">
          <CardHeader className="border-b border-border !py-4">
            <CardTitle className="text-base">Room types</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room type</TableHead>
                  <TableHead className="text-right">Stays</TableHead>
                  <TableHead className="text-right">Room nights</TableHead>
                  <TableHead className="text-right">Avg. rate</TableHead>
                  <TableHead className="text-right">Occupancy</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byRoom.map((r) => (
                  <TableRow key={r.roomId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.stays}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.roomNights}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.adr === null ? "—" : r.adr.toFixed(0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{percent(r.occupancyPct)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{money(report.currency, r.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
                    <span className="font-medium">{money(report.currency, c.revenue)}</span>
                    <span className="ml-2 text-muted-foreground">{c.bookings}</span>
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
