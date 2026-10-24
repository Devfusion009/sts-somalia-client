"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
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
  DialogFooter,
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
      {room ? (
        <DialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Edit ${room.name}`} title="Edit room" />}>
          <Pencil aria-hidden="true" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" />}>
          <Plus aria-hidden="true" /> Add room
        </DialogTrigger>
      )}
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

          <Field>
            <FieldLabel htmlFor="room-name">Room type</FieldLabel>
            <input type="hidden" name="name" value={name} />
            <RoomTypeCombobox id="room-name" value={name} onValueChange={setName} types={roomTypes} />
          </Field>

          {!room ? <RoomPhotosField id="room-photos" /> : null}

          <Field>
            <FieldLabel htmlFor="room-description">Description</FieldLabel>
            <Textarea id="room-description" name="description" rows={2} defaultValue={room?.description ?? ""} />
          </Field>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="totalUnits">Rooms of this type</FieldLabel>
              <Input
                id="totalUnits"
                name="totalUnits"
                type="number"
                min={1}
                max={5000}
                defaultValue={room?.total_units ?? ""}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="maxOccupancy">Max occupancy</FieldLabel>
              <Input
                id="maxOccupancy"
                name="maxOccupancy"
                type="number"
                min={1}
                defaultValue={room?.max_occupancy ?? 2}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="bedType">Bed type</FieldLabel>
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
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="floor">Floor</FieldLabel>
              <RoomFloorField id="floor" defaultValue={room?.floor ?? null} />
            </Field>
            <Field>
              <FieldLabel htmlFor="sizeSqm">Room size</FieldLabel>
              <RoomSizeField id="sizeSqm" defaultSqm={room?.size_sqm ?? null} />
            </Field>
          </div>

          <div className="grid grid-cols-[1fr_6rem] gap-4">
            <Field>
              <FieldLabel htmlFor="basePrice">Price / night</FieldLabel>
              <Input
                id="basePrice"
                name="basePrice"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={room?.base_price || ""}
                className="tabular-nums"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="currency">Currency</FieldLabel>
              <Input id="currency" name="currency" maxLength={3} className="uppercase" defaultValue={room?.currency ?? "USD"} required />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="room-amenities">Room features</FieldLabel>
            <input type="hidden" name="amenities" value={JSON.stringify(amenities)} />
            <RoomAmenitiesField id="room-amenities" value={amenities} onValueChange={setAmenities} />
          </Field>

          {room ? (
            <Field>
              <FieldLabel>Photos</FieldLabel>
              <GalleryManager
                id={room.id}
                paths={Array.isArray(room.images) ? room.images.filter((p): p is string => typeof p === "string") : []}
                bucket="hotel-images"
                uploadAction={uploadRoomImagesPartner}
                removeAction={removeRoomImagePartner}
                setCoverAction={setRoomCoverImagePartner}
              />
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="room-status">Status</FieldLabel>
            {!room || ["draft", "pending_review"].includes(room.status) ? (
              <Select name="status" defaultValue={room?.status ?? "draft"}>
                <SelectTrigger id="room-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_review">Submit for review</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              // Published/suspended is admin-only from here — see EditHotelForm.
              <div className="flex h-8 items-center">
                <Badge variant={statusBadgeVariant(room.status)} className="capitalize" title="Set by STS">
                  {room.status.replace(/_/g, " ")}
                </Badge>
                <input type="hidden" name="status" value="draft" />
              </div>
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{room ? "Save changes" : "Add room"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
