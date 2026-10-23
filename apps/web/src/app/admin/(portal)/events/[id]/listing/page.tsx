import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueByIdAdmin } from "@/modules/admin/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { PropertyReviews } from "@/components/admin/property-reviews";
import { uploadVenueImages, removeVenueImage, setVenueCoverImage } from "@/modules/admin/property-gallery-actions";
import { getVenueManagers } from "@/modules/events/venue-manager-queries";
import { VenueManagersSection } from "@/modules/hotels/components/manager-form";

export const metadata: Metadata = { title: "Venue Listing" };

export default async function AdminVenueListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [venue, managers] = await Promise.all([getVenueByIdAdmin(id), getVenueManagers(id)]);
  if (!venue) notFound();
  const images = Array.isArray(venue.images) ? venue.images.filter((p): p is string => typeof p === "string") : [];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photos &amp; video</CardTitle>
          </CardHeader>
          <CardContent>
            <GalleryManager
              id={venue.id}
              paths={images}
              bucket="venue-images"
              uploadAction={uploadVenueImages}
              removeAction={removeVenueImage}
              setCoverAction={setVenueCoverImage}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <PropertyReviews venueId={venue.id} reviews={venue.property_reviews} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent>
          <VenueManagersSection venueId={venue.id} managers={managers} />
        </CardContent>
      </Card>
    </div>
  );
}
