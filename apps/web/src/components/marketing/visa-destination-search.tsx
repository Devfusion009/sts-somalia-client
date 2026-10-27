"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { matchesDestination, type DestinationOption } from "@/modules/visa/search";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
} from "@/components/ui/combobox";
import { COUNTRY_OPTIONS, countryFlag, countrySearchText, normalizeSearchTerm } from "@/lib/countries";

const MAX_SUGGESTIONS = 6;
const RESULTS_ANCHOR = "visa-results";

const COUNTRY_CODES = COUNTRY_OPTIONS.map(([code]) => code);
const COUNTRY_NAME = Object.fromEntries(COUNTRY_OPTIONS);
const countryLabel = (code: string) => `${countryFlag(code)} ${COUNTRY_NAME[code]}`;

/** Word-start match, so "ke" finds Kenya before every name that merely contains "ke". */
function matchesCountry(code: string, query: string) {
  const q = normalizeSearchTerm(query);
  if (!q) return true;
  return countrySearchText(code)
    .split(/[\s-]+/)
    .some((word) => word.startsWith(q));
}

/** The traveller's passport country: decides which visa applies and what it costs. */
function PassportField({ value, onChange }: { value: string | null; onChange: (code: string | null) => void }) {
  return (
    <Combobox
      items={COUNTRY_CODES}
      itemToStringLabel={countryLabel}
      filter={matchesCountry}
      value={value}
      onValueChange={(code) => onChange(code ?? null)}
      autoHighlight
    >
      <ComboboxInputGroup className="min-w-0 flex-1 sm:w-44 sm:flex-none">
        <ComboboxInput
          aria-label="Passport country"
          placeholder="Your passport"
          className="h-11 border-0 bg-transparent px-0 text-base font-medium text-neutral-900 shadow-none placeholder:text-neutral-500 focus-visible:ring-0 sm:text-sm dark:bg-transparent"
        />
      </ComboboxInputGroup>
      <ComboboxPortal>
        <ComboboxPositioner>
          <ComboboxPopup>
            <ComboboxEmpty>No country found.</ComboboxEmpty>
            <ComboboxList>
              {(code: string) => (
                <ComboboxItem key={code} value={code}>
                  {countryLabel(code)}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </ComboboxPositioner>
      </ComboboxPortal>
    </Combobox>
  );
}

/**
 * Hero destination search. Suggests destinations that actually have a visa as
 * the visitor types, and sends them to the results with the page scrolled to
 * them — the results sit below the hero, so a plain reload looked like
 * nothing had happened.
 */
export function VisaDestinationSearch({
  destinations,
  defaultValue = "",
  defaultPassport = null,
}: {
  destinations: DestinationOption[];
  defaultValue?: string;
  /** Passport country (ISO code) from the URL; no default — the traveller picks it. */
  defaultPassport?: string | null;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [passport, setPassport] = useState<string | null>(defaultPassport);
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
    const params = new URLSearchParams();
    if (passport) params.set("from", passport);
    if (trimmed) params.set("country", trimmed);
    const query = params.toString();
    router.push(`/visa${query ? `?${query}` : ""}#${RESULTS_ANCHOR}`);
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
      className="relative mt-8 max-w-2xl"
    >
      <div className="flex flex-col gap-1 rounded-2xl bg-white p-1.5 shadow-2xl ring-primary/40 focus-within:ring-3 sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-full">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3.5 sm:border-r sm:border-b-0 sm:pr-3 sm:pl-4">
          <span className="text-base leading-none" aria-hidden>
            {passport ? countryFlag(passport) : "🛂"}
          </span>
          <PassportField value={passport} onChange={setPassport} />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 pl-3.5 sm:pl-1">
        <MapPin className="size-4 shrink-0 text-neutral-500" aria-hidden />
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
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-500 sm:text-sm"
        />
        <button
          type="submit"
          aria-label="Search"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ArrowRight className="size-4.5" aria-hidden />
        </button>
        </div>
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
                <span className="text-xl leading-none" aria-hidden>{option.flag}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{option.name}</span>
                <span className="shrink-0 text-xs font-medium text-neutral-500 tabular-nums">
                  From {option.currency} {option.fromPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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
