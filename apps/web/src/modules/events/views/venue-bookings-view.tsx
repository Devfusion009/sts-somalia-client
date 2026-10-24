import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronRight, Plus, Search } from "lucide-react";
import { eventTypeLabel } from "@sts/shared-types";
import { todayIso } from "@/modules/hotels/availability";
import { deskPayment, expirePastHallRequests, getVenueDeskBookings, type DeskBooking } from "@/modules/events/venue-manager-queries";
import type { VenueAccess } from "@/modules/events/venue-access";
import { shortTime } from "@/modules/events/venue-desk-types";
import { venueMoney } from "@/modules/events/components/amenities";
import { HallPaymentLabel, HallStatusBadge } from "@/modules/events/components/hall-badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterChips } from "@/components/dashboard/filter-chips";

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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips
          label="Filter bookings"
          active={view}
          showZero
          items={VIEWS.map((v) => ({
            key: v.key,
            label: v.label,
            href: `${base}/bookings?view=${v.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
            count: counts[v.key],
          }))}
        />
        <div className="flex items-center gap-2">
          <form role="search" className="min-w-0 flex-1 lg:w-64 lg:flex-none">
            <input type="hidden" name="view" value={view} />
            <InputGroup className="max-sm:h-10">
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Reference, client, phone"
                aria-label="Search bookings"
              />
            </InputGroup>
          </form>
          {canManage ? (
            <Button className="shrink-0" render={<Link href={`${base}/bookings/new`} />}>
              <Plus aria-hidden="true" /> New booking
            </Button>
          ) : null}
        </div>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>{q ? "No bookings match" : "No bookings"}</EmptyTitle>
          </Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead numeric>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8">
                    <span className="sr-only">Open</span>
                  </TableHead>
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
                        <Link
                          href={href}
                          className="rounded-sm font-medium tabular-nums outline-none after:absolute after:inset-0 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
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
                        <p className="truncate text-xs text-muted-foreground tabular-nums">
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
                      <TableCell numeric className="whitespace-nowrap">
                        <p className="tabular-nums">
                          {Number(b.price) > 0 ? venueMoney(b.currency, b.price) : <span className="text-muted-foreground">Not set</span>}
                        </p>
                        <HallPaymentLabel state={deskPayment(b)} />
                      </TableCell>
                      <TableCell>
                        <HallStatusBadge status={b.status} />
                      </TableCell>
                      <TableCell>
                        <ChevronRight
                          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
        </Card>
      )}
    </div>
  );
}
