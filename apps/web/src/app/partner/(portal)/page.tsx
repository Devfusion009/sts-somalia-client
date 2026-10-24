import Link from "next/link";
import { ArrowRight, Plus, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyHotelScope,
  getMyPartner,
  getPartnerStats,
  getRecentPartnerBookings,
} from "@/modules/hotels/partner-queries";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateSpan, money } from "@/lib/money";

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
      <PageHeader
        title={partner?.name ?? "Dashboard"}
        status={
          partner ? (
            <Badge variant={statusBadgeVariant(partner.status)} className="capitalize">
              {partner.status.replace(/_/g, " ")}
            </Badge>
          ) : (
            <Badge variant="secondary">Manager</Badge>
          )
        }
        meta={partner ? <span className="tabular-nums">{partner.commission_rate}% commission</span> : undefined}
        actions={
          <>
            {stats.pendingCount > 0 ? (
              <Button variant="outline" render={<Link href="/partner/bookings" />}>
                Review requests
                <Badge variant="warning" className="tabular-nums">
                  {stats.pendingCount}
                </Badge>
              </Button>
            ) : null}
            {scope.partnerId ? (
              <Button render={<Link href="/partner/hotels/new" />}>
                <Plus aria-hidden="true" /> Add hotel
              </Button>
            ) : null}
          </>
        }
      />

      <StatRail>
        <StatRailItem
          label="Hotels"
          value={stats.hotelCount}
          sub={`${stats.roomCount} room type${stats.roomCount === 1 ? "" : "s"}`}
        />
        <StatRailItem label="Bookings" value={stats.bookingCount} />
        <StatRailItem
          label="Pending"
          value={stats.pendingCount}
          tone={stats.pendingCount > 0 ? "warn" : undefined}
        />
        <StatRailItem label="Confirmed revenue" value={money(stats.revenue, stats.revenueCurrency)} />
      </StatRail>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle className="text-base">Recent bookings</CardTitle>
          {recent.length > 0 ? (
            <CardAction>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="All bookings"
                title="All bookings"
                render={<Link href="/partner/bookings" />}
              >
                <ArrowRight />
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        {recent.length === 0 ? (
          <CardContent className="pb-6">
            <Empty>
              <EmptyMedia variant="icon">
                <Ticket />
              </EmptyMedia>
              <EmptyTitle>No bookings</EmptyTitle>
            </Empty>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hotel</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.hotels?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{b.hotel_rooms?.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateSpan(b.check_in, b.check_out)}
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {money(b.total_price, b.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(b.status)} className="capitalize">
                      {b.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
