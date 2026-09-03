import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImageIcon, MessageSquareText } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { getVenueByIdAdmin } from "@/modules/admin/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { PropertyReviews } from "@/components/admin/property-reviews";
import { uploadVenueImages, removeVenueImage, setVenueCoverImage } from "@/modules/admin/property-gallery-actions";
import { VenueForm } from "../venue-form";

export const metadata: Metadata = { title: "Manage Venue" };

export default async function AdminVenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = await getVenueByIdAdmin(id);
  if (!venue) notFound();

  const images = Array.isArray(venue.images) ? venue.images.filter((p): p is string => typeof p === "string") : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackLink href="/admin/events" label="All venues" className="mb-3" />
          <h1 className="font-heading text-2xl font-semibold">{venue.name}</h1>
          <p className="text-sm text-muted-foreground">{venue.city}</p>
        </div>
        <VenueForm venue={venue} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-4 text-primary" /> Photos &amp; video
          </CardTitle>
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
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="size-4 text-primary" /> Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyReviews venueId={venue.id} reviews={venue.property_reviews} />
        </CardContent>
      </Card>
    </div>
  );
}
