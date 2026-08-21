import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyHotelScope, getHotelForEdit, getHotelFrontDesk } from "@/modules/hotels/partner-queries";
import { hotelGuestNames } from "@/modules/payments/queries";
import { getRoomTypes } from "@/modules/hotels/room-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GalleryManager } from "@/components/admin/gallery-manager";
import {
  uploadHotelImagesPartner,
  removeHotelImagePartner,
  setHotelCoverImagePartner,
} from "@/modules/hotels/hotel-gallery-actions";
import { EditHotelForm } from "./edit-hotel-form";
import { RoomDialog } from "./room-form";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  published: "default",
  draft: "secondary",
  pending_review: "secondary",
  suspended: "destructive",
};

export default async function EditHotelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const hotel = await getHotelForEdit(id, scope.hotelIds);
  if (!hotel) notFound();
  const roomTypes = await getRoomTypes();
  // Editing the hotel's own core listing fields (name, address, star rating)
  // stays owning-partner-only — a hotel_manager (or a partner acting on a
  // hotel they don't themselves own, e.g. an STS-direct property they were
  // assigned to manage) runs rooms/bookings only, never this.
  const canEditHotel = scope.partnerId !== null && hotel.partner_id === scope.partnerId;

  // Photos are media, not core identity — the owning partner always has
  // them; a manager only when admin granted can_manage_photos (see
  // hotel-gallery-actions.ts for the write-side check that actually matters).
  let canManagePhotos = canEditHotel;
  if (!canManagePhotos && scope.partnerId === null) {
    const supabase = await createClient();
    const { data: manager } = await supabase
      .from("hotel_managers")
      .select("can_manage_photos")
      .eq("hotel_id", id)
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .maybeSingle();
    canManagePhotos = manager?.can_manage_photos ?? false;
  }
  const images = Array.isArray(hotel.images) ? hotel.images.filter((p): p is string => typeof p === "string") : [];
  const frontDesk = await getHotelFrontDesk(id, scope.hotelIds);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{hotel.name}</h1>
        <p className="text-sm text-muted-foreground">
          {hotel.city}, {hotel.country_code}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Front desk
            <Badge variant="secondary">
              {frontDesk.inHouse.length} in house · {frontDesk.arrivingToday.length} arriving ·{" "}
              {frontDesk.departingToday.length} departing
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {frontDesk.inHouse.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one in house right now.</p>
          ) : (
            <ul className="divide-y divide-border">
              {frontDesk.inHouse.map((booking) => (
                <li key={booking.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{hotelGuestNames(booking.guest_details)[0] ?? "Guest"}</p>
                    <p className="text-xs text-muted-foreground">{booking.hotel_rooms?.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Until {booking.check_out}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canEditHotel ? (
        <Card>
          <CardHeader>
            <CardTitle>Hotel details</CardTitle>
          </CardHeader>
          <CardContent>
            <EditHotelForm hotel={hotel} />
          </CardContent>
        </Card>
      ) : null}

      {canManagePhotos ? (
        <Card>
          <CardHeader>
            <CardTitle>Photos &amp; media</CardTitle>
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
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            Rooms
            <Badge variant="secondary">{hotel.hotel_rooms.length}</Badge>
          </CardTitle>
          <RoomDialog hotelId={hotel.id} roomTypes={roomTypes} />
        </CardHeader>
        <CardContent className="space-y-3">
          {hotel.hotel_rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms yet. Add one to start taking bookings.</p>
          ) : (
            hotel.hotel_rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{room.name}</p>
                    <Badge variant={STATUS_VARIANT[room.status] ?? "secondary"} className="capitalize">
                      {room.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Up to {room.max_occupancy} guests · {room.currency} {room.base_price.toFixed(0)} / night
                    {room.floor ? ` · Floor ${room.floor}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    render={<Link href={`/partner/hotels/${hotel.id}/rooms/${room.id}`} />}
                  >
                    <CalendarDays className="size-3.5" /> Availability
                  </Button>
                  <RoomDialog hotelId={hotel.id} room={room} roomTypes={roomTypes} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
