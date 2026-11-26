"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COUNTRY_DIAL_CODES } from "./country-codes";

function FlagIcon({ iso2, className = "" }: { iso2: string; className?: string }) {
  return <span className={`fi fis fi-${iso2} shrink-0 rounded-[2px] ${className}`} />;
}

/**
 * Searchable country-dial-code picker — a plain, non-portaled dropdown
 * (same pattern as RoleField/LocationField), not a Base UI Select. That
 * choice is deliberate: a Base UI Select's floating popup was the root
 * cause of the "star rating won't close" bug elsewhere in this wizard, so
 * every combobox-style picker here stays a simple absolute-positioned div
 * that reliably closes on blur/selection instead.
 */
export function CountryCodeSelect({ value, onChange }: { value: string; onChange: (dial: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownId = useId();

  const selected = COUNTRY_DIAL_CODES.find((c) => c.dial === value) ?? COUNTRY_DIAL_CODES[0];

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/^\+/, "");
    if (!needle) return COUNTRY_DIAL_CODES;
    return COUNTRY_DIAL_CODES.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.dial.replace("+", "").includes(needle) || c.iso2.toLowerCase() === needle
    );
  }, [query]);

  function select(dial: string) {
    onChange(dial);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0 self-stretch"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          setQuery("");
          triggerRef.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Country code"
        aria-expanded={open}
        aria-controls={open ? dropdownId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-full min-h-11 min-w-24 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-input bg-card px-3 text-sm shadow-none outline-none transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 dark:bg-input/30"
      >
        <FlagIcon iso2={selected.iconIso2} />
        <span>{selected.dial}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div id={dropdownId} className="absolute top-full left-0 z-20 mt-2 w-64 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-border bg-popover shadow-lg ring-1 ring-foreground/5">
          <div className="border-b border-border p-1.5">
            <Input
              autoFocus
              placeholder="Search country or code…"
              aria-label="Search country or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>
            ) : (
              results.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => select(c.dial)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <FlagIcon iso2={c.iconIso2} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground">{c.dial}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
