"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/auth/actions";
import { Plus, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { createRoom, updateRoom } from "@/modules/admin/actions";
import { uploadRoomImages, removeRoomImage, setRoomCoverImage } from "@/modules/admin/property-gallery-actions";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { RoomPhotosField } from "@/modules/hotels/components/room-photos-field";
import { RoomTypeCombobox } from "@/modules/hotels/components/room-type-combobox";
import { RoomAmenitiesField } from "@/modules/hotels/components/room-amenities-field";
import { RoomFloorField } from "@/modules/hotels/components/room-floor-field";
import { RoomSizeField } from "@/modules/hotels/components/room-size-field";
import { ROOM_AMENITIES, ROOM_BED_TYPES } from "@/modules/hotels/constants";

type Room = {
  id: string;
  name: string;
  name_so: string | null;
  description: string | null;
  description_so: string | null;
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

const KNOWN_ROOM_AMENITIES = new Set<string>(ROOM_AMENITIES.map((a) => a.value));

export function RoomDialog({ hotelId, room, roomTypes }: { hotelId: string; room?: Room; roomTypes: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(room?.name ?? "");
  // Same self-healing filter as AmenitiesField: a value the checkbox grid
  // doesn't render must not silently survive every future save.
  const [amenities, setAmenities] = useState<string[]>(() => {
    const raw = Array.isArray(room?.amenities) ? (room.amenities as string[]) : [];
    return raw.filter((a) => KNOWN_ROOM_AMENITIES.has(a));
  });
  const action = room ? updateRoom : createRoom;
  const [state, formAction] = useActionState(action, null);

  // Derived during render (not an effect) per React's guidance for reacting
  // to a state change; router.refresh() is the actual side effect and stays
  // in the effect below.
  const [lastState, setLastState] = useState<ActionState>(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }
  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {room ? (
        <DialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Edit ${room.name}`} />}>
          <Pencil />
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

          <Field>
            <FieldLabel htmlFor="room-name-so">Room type (Somali)</FieldLabel>
            <Input id="room-name-so" name="nameSo" defaultValue={room?.name_so ?? ""} />
          </Field>

          {!room ? <RoomPhotosField id="room-photos" /> : null}

          <Field>
            <FieldLabel htmlFor="room-description">Description</FieldLabel>
            <Textarea id="room-description" name="description" rows={2} defaultValue={room?.description ?? ""} />
          </Field>

          <Field>
            <FieldLabel htmlFor="room-description-so">Description (Somali)</FieldLabel>
            <Textarea id="room-description-so" name="descriptionSo" rows={2} defaultValue={room?.description_so ?? ""} />
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
              <Input id="maxOccupancy" name="maxOccupancy" type="number" min={1} defaultValue={room?.max_occupancy ?? 2} required />
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
                uploadAction={uploadRoomImages}
                removeAction={removeRoomImage}
                setCoverAction={setRoomCoverImage}
              />
            </Field>
          ) : null}

          {room ? (
            <Field>
              <FieldLabel htmlFor="room-status">Status</FieldLabel>
              <Select name="status" defaultValue={room.status}>
                <SelectTrigger id="room-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_review">Pending review</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : (
            // Admin-authored rooms go straight to published — the same
            // authority that could publish it a moment later on the Status
            // select anyway, so requiring that extra click on every new room
            // was pure friction. Suspend/unpublish is still available once
            // the room exists, via Edit.
            <input type="hidden" name="status" value="published" />
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{room ? "Save changes" : "Add room"}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
