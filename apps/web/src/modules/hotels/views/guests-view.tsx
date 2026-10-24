import Link from "next/link";
import { format } from "date-fns";
import { Download, Search, Users } from "lucide-react";
import { getGuestDirectory, type Guest } from "@/modules/hotels/guest-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money } from "@/lib/money";

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
      <PageHeader
        title="Guests"
        actions={
          <Button
            variant="outline"
            size="icon"
            aria-label="Export CSV"
            title="Export CSV"
            render={<a href={`${base}/guests/export`} />}
          >
            <Download />
          </Button>
        }
      />

      <StatRail>
        <StatRailItem label="Guests" value={all.length} />
        <StatRailItem label="Returning" value={returning} />
        <StatRailItem label="Arriving soon" value={arriving} />
        <StatRailItem label="Online accounts" value={all.filter((g) => g.channel === "online").length} />
      </StatRail>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips
          label="Guest channel"
          active={channel}
          items={CHANNELS.map((c) => ({ key: c.key, label: c.label, href: hrefFor(c.key) }))}
        />
        <form method="get" role="search" className="w-full sm:w-72">
          {channel !== "all" ? <input type="hidden" name="channel" value={channel} /> : null}
          <InputGroup className="max-sm:h-10">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput name="q" type="search" defaultValue={q} placeholder="Name, phone or email" aria-label="Search guests" />
          </InputGroup>
        </form>
      </div>

      {guests.length === 0 ? (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>{all.length === 0 ? "No guests" : "No guests match"}</EmptyTitle>
          </Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead numeric>Stays</TableHead>
                  <TableHead numeric>Room nights</TableHead>
                  <TableHead numeric>Spent</TableHead>
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
                        className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {g.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {g.phone ? <span>{g.phone}</span> : null}
                        {g.email ? <span>{g.email}</span> : null}
                        <Badge variant="neutral" className="h-4 px-1.5 text-[11px] capitalize">
                          {g.channel}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell numeric>{g.stays}</TableCell>
                    <TableCell numeric>{g.roomNights}</TableCell>
                    <TableCell numeric>
                      {money(g.totalSpent, g.currency)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{day(g.lastStay)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{day(g.nextArrival)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </Card>
      )}
    </div>
  );
}
