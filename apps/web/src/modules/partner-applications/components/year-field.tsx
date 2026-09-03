"use client";

import { useMemo, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Click-to-select year field — typing narrows the list by prefix (e.g. "19"
 * -> the 1900s), clicking a year fills it in. Same non-portaled dropdown
 * pattern as CountryField/CountryCodeSelect/RoleField, not a Base UI
 * Select: its floating popup previously caused the "star rating won't
 * close" bug elsewhere in this wizard.
 */
export function YearField({
  name,
  defaultValue,
  min,
  max,
  required,
}: {
  name: string;
  defaultValue?: string;
  min: number;
  max: number;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const years = useMemo(() => {
    const list: string[] = [];
    for (let y = max; y >= min; y--) list.push(String(y));
    return list;
  }, [min, max]);

  const matches = useMemo(() => {
    const needle = value.trim();
    return needle ? years.filter((y) => y.startsWith(needle)) : years;
  }, [value, years]);

  function select(year: string) {
    setValue(year);
    setOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <div className="relative">
        <Calendar className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onFocus={() => setOpen(true)}
          placeholder="Select year"
          className="pl-9"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          required={required}
        />
      </div>
      {open && matches.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-56 w-40 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md ring-1 ring-foreground/10">
          {matches.map((y) => (
            <button
              key={y}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                select(y);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {y}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
