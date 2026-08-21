"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";

type Prediction = { id: string; text: string };

/**
 * City/location input with live autocomplete via /api/places/autocomplete —
 * see src/lib/provider-runtime/location-search.ts for the provider (free
 * Photon/OpenStreetMap by default, swappable to Google Places via env var).
 *
 * Works two ways: pass `name`+`defaultValue` for uncontrolled use inside a
 * native `<form>` (partner applications), or `value`+`onChange` for
 * controlled use inside client-side search forms (home hero, hotels page)
 * that build their own query params instead of submitting a form.
 */
export function LocationField({
  name,
  defaultValue,
  value: controlledValue,
  onChange: controlledOnChange,
  required,
  placeholder,
  id,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const setValue = isControlled ? controlledOnChange! : setInternalValue;
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (value.trim().length < 2) {
        setPredictions([]);
        return;
      }
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(value)}`);
        const data = await res.json();
        setPredictions(data.predictions ?? []);
      } catch {
        setPredictions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="pl-8"
        />
      </div>
      {open && predictions.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md ring-1 ring-foreground/10">
          {predictions.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setValue(p.text);
                setPredictions([]);
                setOpen(false);
              }}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
              {p.text}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
