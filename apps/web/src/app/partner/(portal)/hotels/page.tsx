import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyHotelScope, getMyHotels } from "@/modules/hotels/partner-queries";
import { hotelImageUrls } from "@/modules/hotels/images";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "My Hotels" };

export default async function PartnerHotelsPage() {
  const profile = await requireUser();
  const scope = await getMyHotelScope(profile.id);

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
      <PageHeader
        title="My Hotels"
        status={
          hotels.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {hotels.length}
            </Badge>
          ) : null
        }
        actions={
          canCreateHotel && hotels.length > 0 ? (
            <Button render={<Link href="/partner/hotels/new" />}>
              <Plus aria-hidden="true" /> Add hotel
            </Button>
          ) : null
        }
      />

      {hotels.length === 0 ? (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No hotels</EmptyTitle>
            {canCreateHotel ? (
              <EmptyContent>
                <Button render={<Link href="/partner/hotels/new" />}>
                  <Plus aria-hidden="true" /> Add hotel
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((hotel) => {
            const image = hotelImageUrls(hotel.images)[0];
            const meta = [
              `${hotel.city}, ${hotel.country_code}`,
              `${hotel.roomCount} room type${hotel.roomCount === 1 ? "" : "s"}`,
              hotel.star_rating ? `${hotel.star_rating}-star` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={hotel.id}>
                <Link
                  href={`/partner/hotels/${hotel.id}`}
                  className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card className="h-full gap-0 py-0 transition-shadow group-hover:shadow-md">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="aspect-[16/9] w-full object-cover" />
                    ) : (
                      <MediaPlaceholder seed={hotel.id} icon={Building2} className="aspect-[16/9] w-full" />
                    )}
                    <CardContent className="space-y-1 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="min-w-0 font-heading text-base leading-tight font-semibold break-words group-hover:underline">
                          {hotel.name}
                        </h2>
                        <Badge variant={statusBadgeVariant(hotel.status)} className="shrink-0 capitalize">
                          {hotel.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="truncate text-sm text-muted-foreground tabular-nums">{meta}</p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
