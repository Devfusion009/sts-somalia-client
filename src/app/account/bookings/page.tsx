import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight, CalendarRange, Layers, List } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMyBookings } from "@/modules/bookings/queries";
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

export const metadata: Metadata = { title: "My Bookings" };

const SUCCESS_MESSAGES: Record<string, string> = {
  hotel: "Your hotel booking was created.",
  flight: "Your flight request was submitted.",
  visa: "Your visa application was submitted.",
  umrah: "Your Umrah booking was created.",
  hall: "Your hall booking request was created.",
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

  const { bookings, orderMeta } = await getMyBookings();

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">My Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every hotel, flight, visa, Umrah and event hall booking you&apos;ve made.
          </p>
        </div>

        {/* Trips vs flat list. Trips is the default because anything booked in
            one checkout belongs together — a flight and the hotel at the other
            end are one journey, not two unrelated rows. */}
        <div className="flex rounded-lg border border-border p-0.5">
          <Button
            size="sm"
            variant={view === "trips" ? "secondary" : "ghost"}
            className="gap-1.5"
            render={<Link href={href({ view: "trips" })} />}
          >
            <Layers className="size-3.5" /> Trips
          </Button>
          <Button
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            className="gap-1.5"
            render={<Link href={href({ view: "list" })} />}
          >
            <List className="size-3.5" /> List
          </Button>
        </div>
      </div>

      {success && SUCCESS_MESSAGES[success] ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>{SUCCESS_MESSAGES[success]}</AlertDescription>
        </Alert>
      ) : null}

      <nav className="flex flex-wrap gap-2" aria-label="Filter bookings">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const count = f.key === "all" ? bookings.length : counts[f.key];
          return (
            <Link
              key={f.key}
              href={href({ filter: f.key })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-primary-foreground/20" : "bg-secondary"
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-medium">
              {bookings.length === 0
                ? "No bookings yet"
                : `Nothing ${filter === "all" ? "here" : `in ${filter}`}`}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {bookings.length === 0
                ? "Browse hotels, flights, visas, or Umrah packages to get started."
                : "Try another filter to see the rest of your bookings."}
            </p>
          </CardContent>
        </Card>
      ) : view === "trips" ? (
        <div className="space-y-4">
          {trips.map((trip) => (
            <Card key={trip.orderId} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-heading text-sm font-bold">
                      {trip.orderNumber ?? "Trip"}
                      {trip.bookings.length > 1 ? (
                        <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                          {trip.bookings.length} bookings in one itinerary
                        </span>
                      ) : null}
                    </p>
                    {trip.startsOn ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarRange className="size-3.5" /> Starts {formatDate(trip.startsOn)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={trip.orderStatus} />
                    <span className="font-semibold">{formatMoney(trip.total, trip.currency)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      render={<Link href={`/account/bookings/${trip.orderId}`} />}
                    >
                      View <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <ul className="divide-y divide-border">
                  {trip.bookings.map((booking) => (
                    <BookingRow key={`${booking.type}-${booking.id}`} booking={booking} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}

          {ungrouped.length > 0 ? (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="border-b border-border bg-muted/40 px-5 py-3">
                  <p className="font-heading text-sm font-bold">Not part of a paid order</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Drafts and requests that haven&apos;t reached checkout yet.
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {ungrouped.map((booking) => (
                    <BookingRow key={`${booking.type}-${booking.id}`} booking={booking} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {visible.map((booking) => (
                <BookingRow key={`${booking.type}-${booking.id}`} booking={booking} />
              ))}
            </ul>
          </CardContent>
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
  return "/account/bookings";
}

function BookingRow({ booking }: { booking: UnifiedBooking }) {
  const Icon = TYPE_ICON[booking.type];

  return (
    <li>
      <Link
        href={bookingHref(booking)}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-muted/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{booking.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {TYPE_LABEL[booking.type]} · {booking.subtitle}
          </p>
        </div>
        <StatusBadge status={booking.status} />
        <span className="font-medium tabular-nums">
          {formatMoney(booking.price, booking.currency)}
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
