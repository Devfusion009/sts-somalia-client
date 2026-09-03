import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, Pencil } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { getHotelRoomAdmin } from "@/modules/admin/queries";
import { getHotelAvailability } from "@/modules/hotels/availability";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { RoomNightsTable } from "@/modules/hotels/components/room-nights-table";
import { uploadRoomImages, removeRoomImage, setRoomCoverImage } from "@/modules/admin/property-gallery-actions";
import { InventoryRangeForm, ClearInventoryForm } from "./inventory-form";

export default async function AdminRoomInventoryPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id, roomId } = await params;
  const room = await getHotelRoomAdmin(roomId);
  if (!room || room.hotel_id !== id) notFound();

  const [availability] = await getHotelAvailability(id, { roomId, days: 60 });
  const nights = availability?.nights ?? [];
  const images = Array.isArray(room.images) ? room.images.filter((p): p is string => typeof p === "string") : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <BackLink href={`/admin/hotels/${id}`} label={room.hotel?.name ?? "Hotel"} className="mb-3" />
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-heading text-2xl font-semibold">{room.name}</h1>
          {room.total_units === null ? (
            <Badge variant="outline" className="text-muted-foreground">Count not set</Badge>
          ) : (
            <Badge variant="secondary">{room.total_units} rooms</Badge>
          )}
        </div>
      </div>

      {room.total_units === null ? (
        <Alert>
          <AlertCircle />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>Room count not set.</span>
            <Button size="sm" variant="outline" className="h-7 gap-1.5" render={<Link href={`/admin/hotels/${id}`} />}>
              <Pencil className="size-3.5" /> Edit room
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Next 60 nights</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <RoomNightsTable nights={nights} currency={room.currency} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Override dates</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryRangeForm hotelId={id} roomId={roomId} currency={room.currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clear overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <ClearInventoryForm hotelId={id} roomId={roomId} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <GalleryManager
            id={roomId}
            paths={images}
            bucket="hotel-images"
            uploadAction={uploadRoomImages}
            removeAction={removeRoomImage}
            setCoverAction={setRoomCoverImage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
