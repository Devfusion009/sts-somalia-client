"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { createRoom, updateRoom } from "@/modules/hotels/partner-actions";
import {
  uploadRoomImagesPartner,
  removeRoomImagePartner,
  setRoomCoverImagePartner,
} from "@/modules/hotels/hotel-gallery-actions";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { RoomPhotosField } from "@/modules/hotels/components/room-photos-field";
import { RoomTypeCombobox } from "@/modules/hotels/components/room-type-combobox";
import { RoomAmenitiesField } from "@/modules/hotels/components/room-amenities-field";
import { RoomFloorField } from "@/modules/hotels/components/room-floor-field";
import { RoomSizeField } from "@/modules/hotels/components/room-size-field";
import { ROOM_BED_TYPES } from "@/modules/hotels/constants";

type Room = {
  id: string;
  name: string;
  description: string | null;
  max_occupancy: number;
  bed_type: string | null;
  floor: string | null;
  size_sqm: number | null;
  amenities: unknown;
  images: unknown;
  base_price: number;
  currency: string;
  total_units: number | null;
  status: string;
};

export function RoomDialog({ hotelId, room, roomTypes }: { hotelId: string; room?: Room; roomTypes: string[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(room?.name ?? "");
  const [amenities, setAmenities] = useState<string[]>(
    Array.isArray(room?.amenities) ? (room.amenities as string[]) : []
  );
  const action = room ? updateRoom : createRoom;
  const [state, formAction] = useActionState(action, null);

  useEffect(() => {
    if (!state || state.error) return;
    queueMicrotask(() => setOpen(false));
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={room ? "outline" : "default"} size="sm" />}>
        {room ? (
          <>
            <Pencil /> Edit
          </>
        ) : (
          <>
            <Plus /> Add room
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{room ? "Edit room" : "Add room"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          {room ? <input type="hidden" name="roomId" value={room.id} /> : null}

          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="room-name">Room type</Label>
            <input type="hidden" name="name" value={name} />
            <RoomTypeCombobox id="room-name" value={name} onValueChange={setName} types={roomTypes} />
          </div>

          {!room ? <RoomPhotosField id="room-photos" /> : null}

          <div className="space-y-2">
            <Label htmlFor="room-description">Description</Label>
            <Textarea id="room-description" name="description" rows={2} defaultValue={room?.description ?? ""} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="totalUnits">Rooms of this type</Label>
              <Input
                id="totalUnits"
                name="totalUnits"
                type="number"
                min={1}
                max={5000}
                defaultValue={room?.total_units ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxOccupancy">Max occupancy</Label>
              <Input
                id="maxOccupancy"
                name="maxOccupancy"
                type="number"
                min={1}
                defaultValue={room?.max_occupancy ?? 2}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bedType">Bed type</Label>
              <Select name="bedType" defaultValue={room?.bed_type ?? ""}>
                <SelectTrigger id="bedType" className="w-full">
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_BED_TYPES.map((bedType) => (
                    <SelectItem key={bedType} value={bedType}>
                      {bedType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="floor">Floor</Label>
              <RoomFloorField id="floor" defaultValue={room?.floor ?? null} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sizeSqm">Room size</Label>
              <RoomSizeField id="sizeSqm" defaultSqm={room?.size_sqm ?? null} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="basePrice">Price / night</Label>
              <Input
                id="basePrice"
                name="basePrice"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={room?.base_price || ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" maxLength={3} defaultValue={room?.currency ?? "USD"} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="room-amenities">Room features</Label>
            <input type="hidden" name="amenities" value={JSON.stringify(amenities)} />
            <RoomAmenitiesField id="room-amenities" value={amenities} onValueChange={setAmenities} />
          </div>

          {room ? (
            <div className="space-y-2">
              <Label>Photos</Label>
              <GalleryManager
                id={room.id}
                paths={Array.isArray(room.images) ? room.images.filter((p): p is string => typeof p === "string") : []}
                bucket="hotel-images"
                uploadAction={uploadRoomImagesPartner}
                removeAction={removeRoomImagePartner}
                setCoverAction={setRoomCoverImagePartner}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="room-status">Status</Label>
            {!room || ["draft", "pending_review"].includes(room.status) ? (
              <Select name="status" defaultValue={room?.status ?? "draft"}>
                <SelectTrigger id="room-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft — keep working on it</SelectItem>
                  <SelectItem value="pending_review">Submit for review</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              // Published/suspended is admin-only from here — see EditHotelForm.
              <div className="flex h-9 items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {room.status.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">Set by STS</span>
                <input type="hidden" name="status" value="draft" />
              </div>
            )}
          </div>

          <SubmitButton pendingText="Saving…">{room ? "Save changes" : "Add room"}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
