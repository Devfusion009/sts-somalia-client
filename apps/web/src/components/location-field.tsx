"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  icon = true,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  id?: string;
  /** Off where the surrounding layout already labels the field with its own pin. */
  icon?: boolean;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const setValue = isControlled ? controlledOnChange! : setInternalValue;
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

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

  // The list is portalled to the body and positioned against the input: the
  // search bars this sits in are `overflow-hidden` rounded containers, which
  // otherwise clip the suggestions down to a sliver of empty panel.
  const showList = open && predictions.length > 0;
  useLayoutEffect(() => {
    if (!showList) return;
    const place = () => {
      const box = wrapRef.current?.getBoundingClientRect();
      if (box) setAnchor({ top: box.bottom + 4, left: box.left, width: box.width });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [showList]);

  const list = showList && anchor ? (
    <div
      style={{ top: anchor.top, left: anchor.left, width: Math.max(anchor.width, 240) }}
      className="fixed z-[70] max-h-64 overflow-y-auto rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
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
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{p.text}</span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        {icon ? (
          <MapPin className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        ) : null}
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
          className={icon ? "pl-8" : undefined}
        />
      </div>
      {list && typeof document !== "undefined" ? createPortal(list, document.body) : null}
    </div>
  );
}
