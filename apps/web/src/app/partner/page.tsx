import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, BedDouble, Building2, CalendarClock, Plus, Ticket, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyHotelScope,
  getMyPartner,
  getPartnerStats,
  getRecentPartnerBookings,
} from "@/modules/hotels/partner-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const BOOKING_BADGE: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  confirmed: "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

export default async function PartnerDashboardPage() {
  const profile = await requireUser();
  const scope = await getMyHotelScope(profile.id);

  const [partner, stats, recent] = await Promise.all([
    scope.partnerId ? getMyPartner(scope.partnerId) : null,
    getPartnerStats(scope.hotelIds),
    getRecentPartnerBookings(scope.hotelIds),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">{partner?.name ?? "Your properties"}</h1>
            {partner ? (
              <Badge variant="secondary" className="capitalize">
                {partner.status}
              </Badge>
            ) : (
              <Badge variant="secondary">Manager</Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {partner ? `Commission rate: ${partner.commission_rate}% · ` : ""}Here&apos;s how your
            properties are performing.
          </p>
        </div>
        {scope.partnerId ? (
          <Button render={<Link href="/partner/hotels/new" />} className="gap-1.5">
            <Plus className="size-4" /> Add hotel
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={Building2} label="Hotels" value={String(stats.hotelCount)} />
        <StatCard icon={BedDouble} label="Rooms" value={String(stats.roomCount)} />
        <StatCard icon={Ticket} label="Total bookings" value={String(stats.bookingCount)} />
        <StatCard
          icon={CalendarClock}
          label="Pending bookings"
          value={String(stats.pendingCount)}
          highlight={stats.pendingCount > 0}
        />
        <StatCard
          icon={Wallet}
          label="Confirmed revenue"
          value={`${stats.revenueCurrency} ${stats.revenue.toFixed(0)}`}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent bookings</CardTitle>
          <Button variant="ghost" size="sm" className="gap-1 text-primary" render={<Link href="/partner/bookings" />}>
            View all <ArrowRight className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No bookings yet — they&apos;ll appear here as soon as travelers book your rooms.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.hotels?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.hotel_rooms?.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(b.check_in), "d MMM")} →{" "}
                      {format(new Date(b.check_out), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {b.currency} {b.total_price.toFixed(0)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "border-transparent capitalize",
                          BOOKING_BADGE[b.status] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            highlight ? "bg-brand-gold/15 text-brand-gold" : "bg-secondary text-primary"
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-xl font-bold">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
