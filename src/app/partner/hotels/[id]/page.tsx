import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMyPartnerId, getHotelForEdit } from "@/modules/hotels/partner-queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const hotel = await getHotelForEdit(id, partnerId);
  if (!hotel) notFound();

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
          <CardTitle>Hotel details</CardTitle>
        </CardHeader>
        <CardContent>
          <EditHotelForm hotel={hotel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Rooms</CardTitle>
            <CardDescription>{hotel.hotel_rooms.length} room type(s)</CardDescription>
          </div>
          <RoomDialog hotelId={hotel.id} />
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
                  </p>
                </div>
                <RoomDialog hotelId={hotel.id} room={room} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
