"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { AMENITIES, AMENITY_LABELS } from "@/modules/partner-applications/config";

const KNOWN = new Set<string>(AMENITIES);

export function AmenitiesField({ initial }: { initial: string[] }) {
  // A value the checkbox list doesn't render (an old key from before the
  // list was standardized) still sat in this state and got resubmitted on
  // every save — invisible and un-removable from the UI. Drop anything the
  // admin can't actually see or uncheck.
  const [checked, setChecked] = useState<string[]>(() => initial.filter((a) => KNOWN.has(a)));
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
