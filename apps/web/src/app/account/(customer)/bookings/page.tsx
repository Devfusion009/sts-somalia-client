import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Layers, List, Luggage } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { getServerTrpc } from "@/lib/trpc/server";
import {
  bookingTimeframe,
  groupIntoTrips,
  type BookingTimeframe,
  type UnifiedBooking,
} from "@/modules/bookings/types";
import {
  TYPE_ICON,
  TYPE_LABEL,
  StatusBadge,
  formatMoney,
  formatDate,
} from "@/modules/bookings/components/booking-shared";
import { cn } from "@/lib/utils";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";

export const metadata: Metadata = { title: "My Bookings" };

const SUCCESS_MESSAGES: Record<string, string> = {
  hotel: "Hotel booking created.",
  flight: "Flight request submitted.",
  visa: "Visa application submitted.",
  umrah: "Umrah booking created.",
  hall: "Hall booking request created.",
};

const FILTERS: Array<{ key: BookingTimeframe | "all"; label: string }> = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

type View = "trips" | "list";

export default async function AccountBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; filter?: string; view?: string }>;
}) {
  const { success, filter: filterParam, view: viewParam } = await searchParams;

  // Default to upcoming: the reason someone opens this page is almost always a
  // trip they are about to take, not one they took last year.
  const filter = (FILTERS.find((f) => f.key === filterParam)?.key ?? "upcoming") as
    | BookingTimeframe
    | "all";
  const view: View = viewParam === "list" ? "list" : "trips";

  const trpc = await getServerTrpc();
  // apps/api is a separate deployment (not yet reachable from every
  // environment) — an empty list here would read as "you have no bookings",
  // which may be false, so this page blocks rather than degrades.
  let bookings, orderMeta;
  try {
    ({ bookings, orderMeta } = await trpc.bookings.myBookings.query());
  } catch {
    return <UnavailableNotice label="My Bookings" />;
  }

  const counts: Record<BookingTimeframe, number> = { upcoming: 0, past: 0, cancelled: 0 };
  for (const booking of bookings) counts[bookingTimeframe(booking)] += 1;

  const visible =
    filter === "all" ? bookings : bookings.filter((b) => bookingTimeframe(b) === filter);
  const { trips, ungrouped } = groupIntoTrips(visible, orderMeta);

  const href = (next: { filter?: string; view?: string }) => {
    const params = new URLSearchParams();
    params.set("filter", next.filter ?? filter);
    params.set("view", next.view ?? view);
    return `/account/bookings?${params.toString()}`;
  };

  // Trips vs flat list. Trips is the default because anything booked in one
  // checkout belongs together — a flight and the hotel at the other end are
  // one journey, not two unrelated rows.
  const viewToggle = (
    <div role="group" aria-label="View" className="flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
      {(
        [
          { key: "trips", label: "Trips", icon: Layers },
          { key: "list", label: "List", icon: List },
        ] as const
      ).map((opt) => (
        <Button
          key={opt.key}
          size="sm"
          variant="ghost"
          aria-current={view === opt.key ? "page" : undefined}
          className={cn(
            "h-7 px-2.5 text-muted-foreground hover:bg-background/60 max-sm:h-9 max-sm:px-3",
            view === opt.key && "bg-background text-foreground shadow-xs hover:bg-background"
          )}
          render={<Link href={href({ view: opt.key })} />}
        >
          <opt.icon data-icon="inline-start" /> {opt.label}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="My bookings" actions={viewToggle} />

      {success && SUCCESS_MESSAGES[success] ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>{SUCCESS_MESSAGES[success]}</AlertDescription>
        </Alert>
      ) : null}

      <FilterChips
        label="Filter bookings"
        active={filter}
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          href: href({ filter: f.key }),
          count: f.key === "all" ? bookings.length : counts[f.key],
        }))}
      />

      {visible.length === 0 ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Luggage />
              </EmptyMedia>
              <EmptyTitle>
                {bookings.length === 0 || filter === "all"
                  ? "No bookings"
                  : `No ${filter} bookings`}
              </EmptyTitle>
            </EmptyHeader>
            {bookings.length === 0 ? (
              <EmptyContent>
                <Button render={<Link href="/hotels" />}>Browse hotels</Button>
              </EmptyContent>
            ) : null}
          </Empty>
        </Card>
      ) : view === "trips" ? (
        <div className="space-y-4">
          {trips.map((trip) => {
            const tripStatus =
              trip.orderStatus === "pending_payment" &&
              trip.bookings.some(
                (b) => (b.type === "hotel" || b.type === "hall") && (b.status === "pending" || b.status === "waitlisted")
              )
                ? trip.bookings.some((b) => (b.type === "hotel" || b.type === "hall") && b.status === "waitlisted")
                  ? "waitlisted"
                  : "awaiting_confirmation"
                : trip.orderStatus;

            return (
              <Card key={trip.orderId} className="gap-0 overflow-hidden py-0">
                <Link
                  href={`/account/bookings/${trip.orderId}`}
                  className="group flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 outline-none transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:gap-4 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading font-semibold">{trip.orderNumber ?? "Trip"}</p>
                    <p className="truncate text-sm text-muted-foreground tabular-nums">
                      {[
                        trip.startsOn ? `Starts ${formatDate(trip.startsOn)}` : null,
                        trip.bookings.length > 1 ? `${trip.bookings.length} bookings` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || TYPE_LABEL[trip.bookings[0]?.type ?? "hotel"]}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <StatusBadge status={tripStatus} />
                    <span className="font-semibold tabular-nums">{formatMoney(trip.total, trip.currency)}</span>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>

                <ul className="divide-y divide-border">
                  {trip.bookings.map((booking) => (
                    <BookingRow key={`${booking.type}-${booking.id}`} booking={booking} />
                  ))}
                </ul>
              </Card>
            );
          })}

          {ungrouped.length > 0 ? (
            <Card className="gap-0 overflow-hidden py-0">
              <div className="border-b border-border bg-muted/40 px-4 py-3 sm:px-5">
                <h2 className="font-heading font-semibold">Drafts &amp; requests</h2>
              </div>
              <ul className="divide-y divide-border">
                {ungrouped.map((booking) => (
                  <BookingRow key={`${booking.type}-${booking.id}`} booking={booking} />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ul className="divide-y divide-border">
            {visible.map((booking) => (
              <BookingRow key={`${booking.type}-${booking.id}`} booking={booking} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Destination for a booking row — its order's itinerary, or the vertical's own page. */
function bookingHref(booking: UnifiedBooking) {
  if (booking.orderId) return `/account/bookings/${booking.orderId}`;
  if (booking.type === "visa") {
    return booking.status === "draft"
      ? `/visa/apply/${booking.id}`
      : `/account/visa/${booking.id}`;
  }
  // The private-Umrah builder resumes to whatever step the draft is actually
  // on (see startUmrahCustomRequest / the landing page's own draft lookup),
  // so linking straight to the landing page — rather than guessing a step
  // number here — is what stays correct if that resume logic ever changes.
  if (booking.type === "umrah" && booking.status === "draft") {
    return "/umrah/private";
  }
  return "/account/bookings";
}

function BookingRow({ booking }: { booking: UnifiedBooking }) {
  const Icon = TYPE_ICON[booking.type];

  return (
    <li>
      <Link
        href={bookingHref(booking)}
        className="group flex items-center gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:gap-4 sm:px-5"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{booking.title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {TYPE_LABEL[booking.type]} · {booking.subtitle}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
          <StatusBadge status={booking.status} />
          <span className="text-sm font-medium tabular-nums">
            {formatMoney(booking.price, booking.currency)}
          </span>
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
