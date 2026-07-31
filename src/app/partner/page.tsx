import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyPartnerId, getMyPartner, getPartnerStats } from "@/lib/data/hotel-partner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function PartnerDashboardPage() {
  const profile = await requireUser();
  const partnerId = await getMyPartnerId(profile.id);

  if (!partnerId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No active hotel partner account was found for your login. Please contact support.
        </CardContent>
      </Card>
    );
  }

  const [partner, stats] = await Promise.all([getMyPartner(partnerId), getPartnerStats(partnerId)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">{partner?.name ?? "Your account"}</h1>
            <Badge variant="secondary" className="capitalize">
              {partner?.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Commission rate: {partner?.commission_rate}%</p>
        </div>
        <Button render={<Link href="/partner/hotels/new" />}>
          <Plus /> Add hotel
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Hotels" value={stats.hotelCount} />
        <StatCard label="Rooms" value={stats.roomCount} />
        <StatCard label="Total bookings" value={stats.bookingCount} />
        <StatCard label="Pending bookings" value={stats.pendingCount} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}
