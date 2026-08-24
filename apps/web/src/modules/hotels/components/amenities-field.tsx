"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { AMENITIES, AMENITY_LABELS } from "@/modules/partner-applications/config";

export function AmenitiesField({ initial }: { initial: string[] }) {
  const [checked, setChecked] = useState<string[]>(initial);
  return (
    <div className="space-y-2">
      <Label>Facilities</Label>
      <div className="flex flex-wrap gap-2">
        {AMENITIES.map((a) => (
          <label
            key={a}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="checkbox"
              checked={checked.includes(a)}
              onChange={(e) => setChecked((prev) => (e.target.checked ? [...prev, a] : prev.filter((v) => v !== a)))}
            />
            {AMENITY_LABELS[a]}
          </label>
        ))}
      </div>
      <input type="hidden" name="amenities" value={checked.join(",")} />
    </div>
  );
}

export function amenitiesList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((v) => String(v)) : [];
}
