"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ROOM_AMENITIES } from "@/modules/hotels/constants";

/**
 * Checkbox grid for hotel_rooms.amenities (jsonb string[]) — the column has
 * existed since the hotels schema shipped, but no room form ever surfaced an
 * input for it. Same controlled-value shape as RoomTypeCombobox: the parent
 * holds the array in state and serializes it into a hidden JSON input for
 * the server action, keeping this component itself string[]-in/string[]-out.
 */
export function RoomAmenitiesField({
  id,
  value,
  onValueChange,
}: {
  id: string;
  value: string[];
  onValueChange: (value: string[]) => void;
}) {
  function toggle(amenity: string, checked: boolean) {
    onValueChange(checked ? [...value, amenity] : value.filter((a) => a !== amenity));
  }

  return (
    <div id={id} className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {ROOM_AMENITIES.map((amenity) => (
        <Label key={amenity.value} className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={value.includes(amenity.value)}
            onCheckedChange={(checked) => toggle(amenity.value, checked === true)}
          />
          {amenity.label}
        </Label>
      ))}
    </div>
  );
}
