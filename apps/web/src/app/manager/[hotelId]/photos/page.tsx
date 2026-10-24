import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel, hasPermission } from "@/modules/hotels/manager-queries";
import { getHotelForEdit } from "@/modules/hotels/partner-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { GalleryManager } from "@/components/admin/gallery-manager";
import {
  uploadHotelImagesPartner,
  removeHotelImagePartner,
  setHotelCoverImagePartner,
} from "@/modules/hotels/hotel-gallery-actions";
import { uploadHotelLogoPartner, removeHotelLogoPartner } from "@/modules/hotels/hotel-logo-actions";
import { hotelLogoUrl } from "@/modules/hotels/images";
import { HotelLogoUploader } from "@/components/admin/hotel-logo-uploader";

export const metadata = { title: "Photos & Media" };

export default async function ManagerPhotosPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed || !hasPermission(managed, "photos")) notFound();

  const hotel = await getHotelForEdit(hotelId, [hotelId]);
  if (!hotel) notFound();
  const images = Array.isArray(hotel.images) ? hotel.images.filter((p): p is string => typeof p === "string") : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Photos & Media" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <HotelLogoUploader
            hotelId={hotel.id}
            logoUrl={hotelLogoUrl(hotel.logo_path)}
            uploadAction={uploadHotelLogoPartner}
            removeAction={removeHotelLogoPartner}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <GalleryManager
            id={hotel.id}
            paths={images}
            bucket="hotel-images"
            uploadAction={uploadHotelImagesPartner}
            removeAction={removeHotelImagePartner}
            setCoverAction={setHotelCoverImagePartner}
          />
        </CardContent>
      </Card>
    </div>
  );
}
