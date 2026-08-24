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

const SQM_PER_SQFT = 0.09290304;

/**
 * size_sqm stays the one stored value (no schema split, no drift between
 * two numbers that could disagree) — this just lets whoever's filling the
 * form think in whichever unit they actually measure in. Switching units
 * converts the displayed number; only m² ever reaches the server.
 */
export function RoomSizeField({ id, defaultSqm }: { id: string; defaultSqm: number | null }) {
  const [unit, setUnit] = useState<"sqm" | "sqft">("sqm");
  const [value, setValue] = useState(defaultSqm != null ? String(defaultSqm) : "");

  function changeUnit(next: "sqm" | "sqft") {
    const n = Number(value);
    if (value !== "" && !Number.isNaN(n)) {
      const converted = next === "sqft" ? n / SQM_PER_SQFT : n * SQM_PER_SQFT;
      setValue(String(Math.round(converted * 100) / 100));
    }
    setUnit(next);
  }

  const sqmValue = unit === "sqm" ? value : value !== "" && !Number.isNaN(Number(value)) ? String(Number(value) * SQM_PER_SQFT) : "";

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="number"
        min={0}
        step="0.1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1"
      />
      <input type="hidden" name="sizeSqm" value={sqmValue} />
      <Select
        value={unit}
        onValueChange={(v) => changeUnit(v as "sqm" | "sqft")}
        items={[
          { value: "sqm", label: "m²" },
          { value: "sqft", label: "ft²" },
        ]}
      >
        <SelectTrigger className="w-20 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sqm">m²</SelectItem>
          <SelectItem value="sqft">ft²</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
