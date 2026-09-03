"use client";

import { useMemo, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COUNTRY_DIAL_CODES } from "./country-codes";

/**
 * Searchable country input — free text with filtered suggestions, same
 * non-portaled dropdown pattern as CountryCodeSelect/RoleField (a Base UI
 * Select's floating popup previously caused the "star rating won't close"
 * bug in this wizard). Stays free text rather than a closed picker: an
 * agency based somewhere outside the curated dial-code list can still type
 * their own country instead of being blocked.
 */
export function CountryField({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const needle = value.trim().toLowerCase();
    const list = needle ? COUNTRY_DIAL_CODES.filter((c) => c.name.toLowerCase().includes(needle)) : COUNTRY_DIAL_CODES;
    return list.slice(0, 8);
  }, [value]);

  function select(countryName: string) {
    setValue(countryName);
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
        <Globe className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          className="pl-9"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
        />
      </div>
      {open && matches.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md ring-1 ring-foreground/10">
          {matches.map((c) => (
            <button
              key={c.iso2}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                select(c.name);
              }}
              className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
