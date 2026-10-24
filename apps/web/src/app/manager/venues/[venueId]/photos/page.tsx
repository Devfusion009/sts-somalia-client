import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedVenue, getVenueForManager, hasVenuePermission } from "@/modules/events/venue-manager-queries";
import {
  removeVenueImageAsManager,
  setVenueCoverImageAsManager,
  uploadVenueImagesAsManager,
} from "@/modules/events/venue-manager-actions";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { GalleryManager } from "@/components/admin/gallery-manager";

export const metadata = { title: "Photos" };

export default async function ManagerVenuePhotosPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedVenue(profile.id, venueId);
  if (!managed || !hasVenuePermission(managed, "photos")) notFound();

  const venue = await getVenueForManager(venueId);
  if (!venue) notFound();
  const images = Array.isArray(venue.images) ? venue.images.filter((p): p is string => typeof p === "string") : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Photos" />
      <Card>
        <CardContent>
          <GalleryManager
            id={venue.id}
            paths={images}
            bucket="venue-images"
            uploadAction={uploadVenueImagesAsManager}
            removeAction={removeVenueImageAsManager}
            setCoverAction={setVenueCoverImageAsManager}
          />
        </CardContent>
      </Card>
    </div>
  );
}
