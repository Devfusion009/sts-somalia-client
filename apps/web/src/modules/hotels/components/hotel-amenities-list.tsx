"use client";

import { useState } from "react";
import { amenityDisplayLabel, amenityIcon, sortAmenities } from "@/modules/hotels/amenity-icons";

/** Result-row facility chips — one icon per amenity, "+N more" expands in place instead of doing nothing. */
export function HotelAmenitiesList({ amenities, limit = 4 }: { amenities: string[]; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (amenities.length === 0) return null;

  const sorted = sortAmenities(amenities);
  const visible = expanded ? sorted : sorted.slice(0, limit);
  const hidden = sorted.length - limit;

  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
      {visible.map((amenity) => {
        const Icon = amenityIcon(amenity);
        return (
          <li key={amenity} className="flex items-center gap-1 text-xs font-medium text-foreground">
            <Icon sx={{ fontSize: 14 }} className="text-primary" aria-hidden />
            {amenityDisplayLabel(amenity)}
          </li>
        );
      })}
      {!expanded && hidden > 0 ? (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            +{hidden} more
          </button>
        </li>
      ) : null}
    </ul>
  );
}
