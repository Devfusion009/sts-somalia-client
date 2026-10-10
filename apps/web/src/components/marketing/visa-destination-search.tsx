"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { matchesDestination, type DestinationOption } from "@/modules/visa/search";

const MAX_SUGGESTIONS = 6;
const RESULTS_ANCHOR = "visa-results";

/**
 * Hero destination search. Suggests destinations that actually have a visa as
 * the visitor types, and sends them to the results with the page scrolled to
 * them — the results sit below the hero, so a plain reload looked like
 * nothing had happened.
 */
export function VisaDestinationSearch({
  destinations,
  defaultValue = "",
}: {
  destinations: DestinationOption[];
  defaultValue?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const suggestions = useMemo(
    () => (value.trim() ? destinations.filter((d) => matchesDestination(d.code, value)) : destinations).slice(0, MAX_SUGGESTIONS),
    [destinations, value]
  );

  function go(term: string) {
    const trimmed = term.trim();
    setOpen(false);
    inputRef.current?.blur();
    router.push(trimmed ? `/visa?country=${encodeURIComponent(trimmed)}#${RESULTS_ANCHOR}` : `/visa#${RESULTS_ANCHOR}`);
  }

  function choose(option: DestinationOption) {
    setValue(option.name);
    go(option.name);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (suggestions.length === 0 ? -1 : (i + 1) % suggestions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (suggestions.length === 0 ? -1 : (i <= 0 ? suggestions.length : i) - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const showList = open && (suggestions.length > 0 || value.trim().length > 0);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && suggestions[active]) choose(suggestions[active]);
        else go(value);
      }}
      className="relative mt-8 max-w-lg"
    >
      <div className="flex items-center gap-1.5 rounded-full bg-white p-1.5 pl-5 shadow-2xl">
        <MapPin className="size-4 shrink-0 text-neutral-400" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Destination country"
          autoComplete="off"
          placeholder="Where are you going? UAE, Türkiye, Kenya…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          aria-label="Search"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-gold text-neutral-900 transition-colors hover:bg-brand-gold/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowRight className="size-4.5" />
        </button>
      </div>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-2xl bg-white py-1.5 text-neutral-900 shadow-2xl ring-1 ring-black/5"
        >
          {suggestions.length > 0 ? (
            suggestions.map((option, i) => (
              <li
                key={option.code}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: the input's blur would close the list before a click lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-2.5",
                  i === active ? "bg-primary/10" : "hover:bg-neutral-50"
                )}
              >
                <span className="text-xl leading-none">{option.flag}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{option.name}</span>
                <span className="shrink-0 text-xs font-medium text-neutral-500 tabular-nums">
                  From {option.currency} {option.fromPrice.toFixed(0)}
                </span>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-neutral-500">No destination matches</li>
          )}
        </ul>
      ) : null}
    </form>
  );
}
