import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Building2, BedDouble, MapPin, Star } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyHotelScope, getMyHotels } from "@/modules/hotels/partner-queries";
import { hotelImageUrls } from "@/modules/hotels/images";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

export default async function PartnerHotelsPage() {
  const profile = await requireUser();
  const scope = await getMyHotelScope(profile.id);

  if (scope.hotelIds.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No active hotel partner account was found for your login. Please contact support.
        </CardContent>
      </Card>
    );
  }

  // A pure manager with exactly one hotel has nothing to pick between here —
  // the sidebar already links straight to it (see navGroupsFor in the
  // layout), but redirect this URL too in case it's reached directly.
  if (scope.partnerId === null && scope.hotelIds.length === 1) {
    redirect(`/partner/hotels/${scope.hotelIds[0]}`);
  }

  const hotels = await getMyHotels(scope.hotelIds);
  // Creating a brand-new hotel requires an actual hotel_partner business to
  // attach it to — a hotel_manager (scope.partnerId null) only ever operates
  // hotels admin already assigned them, never adds one of their own.
  const canCreateHotel = scope.partnerId !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">My Hotels</h1>
        </div>
        {canCreateHotel ? (
          <Button render={<Link href="/partner/hotels/new" />} className="gap-1.5">
            <Plus className="size-4" /> Add hotel
          </Button>
        ) : null}
      </div>

      {hotels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Building2 className="size-5" />
            </span>
            <p className="font-medium">No hotels yet</p>
            <p className="text-sm text-muted-foreground">
              {canCreateHotel
                ? "Add your first property to start taking bookings."
                : "Ask an admin to assign you as a manager on a hotel."}
            </p>
            {canCreateHotel ? (
              <Button render={<Link href="/partner/hotels/new" />} className="gap-1.5">
                <Plus className="size-4" /> Add hotel
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => {
            const image = hotelImageUrls(hotel.images)[0];
            return (
              <Link key={hotel.id} href={`/partner/hotels/${hotel.id}`} className="group block h-full">
                <Card className="h-full overflow-hidden py-0 transition-shadow hover:shadow-md">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={hotel.name} className="h-32 w-full object-cover" />
                  ) : (
                    <MediaPlaceholder seed={hotel.id} icon={Building2} className="h-32 w-full" />
                  )}
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-heading text-base font-bold leading-tight group-hover:text-primary">
                        {hotel.name}
                      </h3>
                      <Badge
                        className={cn(
                          "shrink-0 border-transparent capitalize",
                          STATUS_BADGE[hotel.status] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {hotel.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {hotel.city}, {hotel.country_code}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BedDouble className="size-3.5" />
                        {hotel.roomCount} room{hotel.roomCount === 1 ? "" : "s"}
                      </span>
                      {hotel.star_rating ? (
                        <span className="flex items-center gap-1">
                          <Star className="size-3.5 fill-brand-gold text-brand-gold" />
                          {hotel.star_rating}-star
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
