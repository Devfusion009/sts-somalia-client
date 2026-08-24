"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const PRESET_FLOORS = ["Ground floor", ...Array.from({ length: 15 }, (_, i) => `${ordinal(i + 1)} floor`), "Basement"];
const SELECT_ITEMS = [...PRESET_FLOORS.map((f) => ({ value: f, label: f })), { value: "custom", label: "Custom…" }];

/**
 * Quick-pick the common case (a single numbered floor) without losing the
 * free-text flexibility 20260821000001 deliberately gave hotel_rooms.floor —
 * real properties also need "Mezzanine" or a range like "2-3". "Custom"
 * reveals the same plain text input this field used to be, defaulting to it
 * whenever an EXISTING value isn't one of the presets so an edit never
 * silently discards something like that — a brand new room instead starts
 * with nothing selected, not pre-opened into free text.
 */
export function RoomFloorField({ id, defaultValue }: { id: string; defaultValue: string | null }) {
  const initialIsPreset = !!defaultValue && PRESET_FLOORS.includes(defaultValue);
  const initialIsCustom = !!defaultValue && !initialIsPreset;
  const [selected, setSelected] = useState(initialIsPreset ? defaultValue! : initialIsCustom ? "custom" : "");
  const [customValue, setCustomValue] = useState(initialIsCustom ? defaultValue! : "");

  return (
    <div className="space-y-2">
      <Select value={selected} onValueChange={(v) => setSelected(v ?? "")} items={SELECT_ITEMS}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select a floor" />
        </SelectTrigger>
        <SelectContent>
          {PRESET_FLOORS.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom…</SelectItem>
        </SelectContent>
      </Select>
      {selected === "custom" ? (
        <Input
          name="floor"
          placeholder="e.g. Mezzanine, 2-3"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
        />
      ) : (
        <input type="hidden" name="floor" value={selected} />
      )}
    </div>
  );
}
