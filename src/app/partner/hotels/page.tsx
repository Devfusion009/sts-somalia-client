import Link from "next/link";
import { Plus, Building2, BedDouble } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyPartnerId, getMyHotels } from "@/lib/data/hotel-partner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  published: "default",
  draft: "secondary",
  pending_review: "secondary",
  suspended: "destructive",
};

export default async function PartnerHotelsPage() {
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

  const hotels = await getMyHotels(partnerId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">My Hotels</h1>
          <p className="text-sm text-muted-foreground">Manage your properties and rooms.</p>
        </div>
        <Button render={<Link href="/partner/hotels/new" />}>
          <Plus /> Add hotel
        </Button>
      </div>

      {hotels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Building2 className="size-8 text-muted-foreground" />
            <p className="font-medium">No hotels yet</p>
            <p className="text-sm text-muted-foreground">Add your first property to start taking bookings.</p>
            <Button render={<Link href="/partner/hotels/new" />}>
              <Plus /> Add hotel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => (
            <Link key={hotel.id} href={`/partner/hotels/${hotel.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading text-lg font-semibold leading-tight">{hotel.name}</h3>
                    <Badge variant={STATUS_VARIANT[hotel.status] ?? "secondary"} className="shrink-0 capitalize">
                      {hotel.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {hotel.city}, {hotel.country_code}
                  </p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <BedDouble className="size-3.5" />
                    {hotel.roomCount} room{hotel.roomCount === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
