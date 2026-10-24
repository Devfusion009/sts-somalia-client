import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, Pencil } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { getHotelRoomAdmin } from "@/modules/admin/queries";
import { getHotelAvailability } from "@/modules/hotels/availability";
import { getNightRates } from "@/modules/hotels/rates";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { RoomNightsTable } from "@/modules/hotels/components/room-nights-table";
import { uploadRoomImages, removeRoomImage, setRoomCoverImage } from "@/modules/admin/property-gallery-actions";
import { InventoryRangeForm, ClearInventoryForm } from "./inventory-form";
import { money } from "@/lib/money";

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
  const rates = await getNightRates(await createClient(), room, nights.map((n) => n.night));
  const images = Array.isArray(room.images) ? room.images.filter((p): p is string => typeof p === "string") : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-5">
        <BackLink href={`/admin/hotels/${id}`} label={room.hotel?.name ?? "Hotel"} />
        <header className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{room.name}</h1>
            <Badge variant={statusBadgeVariant(room.status)} className="capitalize">
              {room.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[room.hotel?.name, room.bed_type, room.floor ? `Floor ${room.floor}` : null].filter(Boolean).join(" · ")}
          </p>
        </header>
        <StatRail>
          <StatRailItem
            label="Rooms"
            value={room.total_units ?? "Not set"}
            tone={room.total_units === null ? "warn" : undefined}
          />
          <StatRailItem label="Sleeps" value={room.max_occupancy} />
          <StatRailItem
            label="Base rate"
            value={
              room.base_price > 0
                ? money(room.base_price, room.currency)
                : "On request"
            }
          />
          <StatRailItem label="Photos" value={images.length} />
        </StatRail>
      </div>

      {room.total_units === null ? (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Room count not set.</span>
            <Button size="sm" variant="outline" render={<Link href={`/admin/hotels/${id}`} />}>
              <Pencil aria-hidden="true" /> Edit room
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border pt-4 pb-3">
          <CardTitle className="text-base">Next 60 nights</CardTitle>
        </CardHeader>
        <div>
          <RoomNightsTable nights={nights} currency={room.currency} rates={rates} />
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
