import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, CalendarPlus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getHotelFrontDesk, getPartnerStats, getRecentPartnerBookings } from "@/modules/hotels/partner-queries";
import { hotelGuestNames } from "@/modules/orders/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const HOTEL_STATUS_BADGE: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

const BOOKING_STATUS_BADGE: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "bg-brand-gold/15 text-brand-gold",
  cancelled: "bg-destructive/10 text-destructive",
  completed: "bg-muted text-muted-foreground",
};

function GuestList({
  title,
  emptyLabel,
  bookings,
}: {
  title: string;
  emptyLabel: string;
  bookings: Array<{ id: string; check_in: string; check_out: string; guest_details: unknown; hotel_rooms: { name: string } | null }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="divide-y divide-border">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{hotelGuestNames(b.guest_details)[0] ?? "Guest"}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.hotel_rooms?.name}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {b.check_in} → {b.check_out}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function ManagerDashboardPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed) notFound();

  const [frontDesk, stats, recent] = await Promise.all([
    getHotelFrontDesk(hotelId, [hotelId]),
    getPartnerStats([hotelId]),
    getRecentPartnerBookings([hotelId]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-heading text-2xl font-semibold">{managed.hotel.name}</h1>
          <Badge
            className={cn(
              "border-transparent capitalize",
              HOTEL_STATUS_BADGE[managed.hotel.status] ?? "bg-muted text-muted-foreground"
            )}
          >
            {managed.hotel.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {managed.hotel.city}, {managed.hotel.country_code}
        </p>
      </div>

      {hasPermission(managed, "bookings") ? (
        <Link
          href={`/manager/${hotelId}/rooms`}
          className="flex items-center gap-3 rounded-xl bg-primary px-5 py-4 text-primary-foreground transition-opacity hover:opacity-90"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-foreground/15">
            <CalendarPlus className="size-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-bold">Record an offline booking</span>
          <ArrowRight className="size-4.5 shrink-0" />
        </Link>
      ) : null}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
        {[
          { label: "In house", value: frontDesk.inHouse.length },
          { label: "Arriving today", value: frontDesk.arrivingToday.length },
          { label: "Departing today", value: frontDesk.departingToday.length },
          { label: "Pending bookings", value: stats.pendingCount },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary/40 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-heading text-xl font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-3">
        <GuestList title="Arriving today" emptyLabel="No arrivals today." bookings={frontDesk.arrivingToday} />
        <GuestList title="Departing today" emptyLabel="No departures today." bookings={frontDesk.departingToday} />
        <GuestList title="In house" emptyLabel="No guests in house." bookings={frontDesk.inHouse} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent bookings</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-primary"
            render={<Link href={`/manager/${hotelId}/bookings`} />}
          >
            View all <ArrowRight className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.hotel_rooms?.name ?? "Room"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.check_in} → {b.check_out} · booked {format(new Date(b.created_at), "dd MMM")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium">
                      {b.currency} {Number(b.total_price).toFixed(0)}
                    </span>
                    <Badge
                      className={cn(
                        "border-transparent capitalize",
                        BOOKING_STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {b.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
