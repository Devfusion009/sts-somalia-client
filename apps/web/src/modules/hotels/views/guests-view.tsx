import Link from "next/link";
import { format } from "date-fns";
import { Download, Search } from "lucide-react";
import { getGuestDirectory, type Guest } from "@/modules/hotels/guest-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const CHANNELS = [
  { key: "all", label: "All" },
  { key: "online", label: "Online" },
  { key: "agency", label: "Agency" },
  { key: "offline", label: "Offline" },
] as const;

function day(iso: string | null) {
  return iso ? format(new Date(`${iso}T00:00:00`), "d MMM yyyy") : "—";
}

function matches(guest: Guest, q: string) {
  const needle = q.toLowerCase();
  return [guest.name, guest.email ?? "", guest.phone ?? ""].some((v) => v.toLowerCase().includes(needle));
}

export async function GuestsView({
  hotelId,
  base,
  q = "",
  channel: channelParam,
}: {
  hotelId: string;
  base: string;
  q?: string;
  channel?: string;
}) {

  const channel = CHANNELS.find((c) => c.key === channelParam)?.key ?? "all";
  const all = await getGuestDirectory(hotelId);
  const guests = all.filter((g) => (channel === "all" || g.channel === channel) && (!q.trim() || matches(g, q.trim())));
  const returning = all.filter((g) => g.stays >= 2).length;
  const arriving = all.filter((g) => g.nextArrival !== null).length;
  const hrefFor = (c: string) => {
    const sp = new URLSearchParams();
    if (c !== "all") sp.set("channel", c);
    if (q.trim()) sp.set("q", q.trim());
    const qs = sp.toString();
    return `${base}/guests${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Guests</h1>
        <Button variant="outline" className="gap-1.5" render={<a href={`${base}/guests/export`} />}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        {[
          { label: "Guests", value: all.length },
          { label: "Returning", value: returning },
          { label: "Arriving soon", value: arriving },
          { label: "Online accounts", value: all.filter((g) => g.channel === "online").length },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary/40 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-heading text-xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Guest channel">
          {CHANNELS.map((c) => (
            <Link
              key={c.key}
              href={hrefFor(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                c.key === channel
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </Link>
          ))}
        </nav>
        <form method="get" className="relative w-full sm:w-72">
          {channel !== "all" ? <input type="hidden" name="channel" value={channel} /> : null}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Name, phone or email" className="pl-9" />
        </form>
      </div>

      {guests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">No guests.</CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead className="text-right">Stays</TableHead>
                  <TableHead className="text-right">Room nights</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead>Last stay</TableHead>
                  <TableHead>Next arrival</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell>
                      <Link
                        href={`${base}/guests/${encodeURIComponent(g.key)}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {g.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {g.phone ? <span>{g.phone}</span> : null}
                        {g.email ? <span>{g.email}</span> : null}
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px] capitalize">
                          {g.channel}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{g.stays}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.roomNights}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g.currency} {g.totalSpent.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{day(g.lastStay)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{day(g.nextArrival)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
