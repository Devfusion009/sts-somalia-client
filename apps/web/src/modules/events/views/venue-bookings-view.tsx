import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ChevronRight, Plus, Search } from "lucide-react";
import { eventTypeLabel } from "@sts/shared-types";
import { todayIso } from "@/modules/hotels/availability";
import { deskPayment, expirePastHallRequests, getVenueDeskBookings, type DeskBooking } from "@/modules/events/venue-manager-queries";
import type { VenueAccess } from "@/modules/events/venue-access";
import { shortTime } from "@/modules/events/venue-desk-types";
import { venueMoney } from "@/modules/events/components/amenities";
import { HallPaymentLabel, HallStatusBadge } from "@/modules/events/components/hall-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "requests", label: "Requests" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
] as const;

type View = (typeof VIEWS)[number]["key"];

function inView(view: View, b: DeskBooking, today: string) {
  switch (view) {
    case "upcoming":
      return b.status === "confirmed" && b.end_date >= today;
    case "requests":
      return b.status === "pending" || b.status === "waitlisted";
    case "past":
      return b.end_date < today && (b.status === "confirmed" || b.status === "completed");
    case "cancelled":
      return ["cancelled", "refunded", "failed", "no_show"].includes(b.status);
    default:
      return true;
  }
}

function matches(b: DeskBooking, q: string) {
  const needle = q.toLowerCase();
  return [b.booking_ref, b.contact_name, b.contact_phone, b.event_name, b.agency?.name]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(needle));
}

function channelLabel(b: DeskBooking) {
  return b.channel === "b2b" ? (b.agency?.name ?? "Agency") : b.source === "offline" ? "Desk" : "Online";
}

export async function VenueBookingsView({
  venueId,
  base,
  access,
  view: rawView,
  q: rawQ,
}: {
  venueId: string;
  base: string;
  access: VenueAccess;
  view?: string;
  q?: string;
}) {
  const view: View = VIEWS.some((v) => v.key === rawView) ? (rawView as View) : "upcoming";
  const q = rawQ?.trim() ?? "";
  const today = todayIso();
  await expirePastHallRequests(venueId);
  const all = await getVenueDeskBookings(venueId);
  const searched = q ? all.filter((b) => matches(b, q)) : all;
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, searched.filter((b) => inView(v.key, b, today)).length]));

  const bookings = searched.filter((b) => inView(view, b, today));
  // Work to do reads soonest first; history reads newest first (the query order).
  if (view === "upcoming" || view === "requests") bookings.reverse();

  const canManage = access.can("bookings");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter bookings">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`${base}/bookings?view=${v.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={view === v.key ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                view === v.key
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {v.label}
              <span className={cn("text-xs tabular-nums", view === v.key ? "opacity-80" : "text-muted-foreground")}>
                {counts[v.key]}
              </span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <form className="relative" role="search">
            <input type="hidden" name="view" value={view} />
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Reference, client, phone" aria-label="Search bookings" className="h-9 w-56 pl-8" />
          </form>
          {canManage ? (
            <Button className="gap-1.5" render={<Link href={`${base}/bookings/new`} />}>
              <Plus className="size-4" /> New booking
            </Button>
          ) : null}
        </div>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">No bookings.</CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => {
                  const from = shortTime(b.start_time);
                  const to = shortTime(b.end_time);
                  const href = `${base}/bookings/${b.id}`;
                  return (
                    <TableRow key={b.id} className="group relative">
                      <TableCell className="whitespace-nowrap">
                        <Link href={href} className="font-medium after:absolute after:inset-0 hover:text-primary">
                          {format(parseISO(b.start_date), "EEE d MMM yyyy")}
                        </Link>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {b.end_date !== b.start_date ? `to ${format(parseISO(b.end_date), "d MMM")}` : null}
                          {b.end_date !== b.start_date && from ? " · " : null}
                          {from ? (to ? `${from}–${to}` : `from ${from}`) : b.end_date === b.start_date ? "All day" : null}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-64">
                        <p className="truncate font-medium">{b.event_name || eventTypeLabel(b.event_type)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {b.event_name ? `${eventTypeLabel(b.event_type)} · ` : ""}
                          {b.expected_guests ?? "—"} guests · <span className="font-mono">{b.booking_ref}</span>
                        </p>
                      </TableCell>
                      <TableCell className="max-w-56">
                        <p className="truncate">{b.contact_name ?? "Client"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {channelLabel(b)}
                          {b.contact_phone ? ` · ${b.contact_phone}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <p className="tabular-nums">{Number(b.price) > 0 ? venueMoney(b.currency, b.price) : "Not set"}</p>
                        <HallPaymentLabel state={deskPayment(b)} />
                      </TableCell>
                      <TableCell>
                        <HallStatusBadge status={b.status} />
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
