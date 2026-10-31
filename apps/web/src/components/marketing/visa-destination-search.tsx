"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, BookUser, MapPin, SearchX } from "lucide-react";

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
import { COUNTRY_OPTIONS, countryFlag, countryName, countrySearchText, normalizeSearchTerm } from "@/lib/countries";

const MAX_SUGGESTIONS = 8;
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

/** The part of a name the visitor has typed, in bold, so a match reads at a glance. */
function MatchedName({ name, query }: { name: string; query: string }) {
  const q = query.trim();
  if (q && name.toLowerCase().startsWith(q.toLowerCase())) {
    return (
      <>
        <span className="text-primary">{name.slice(0, q.length)}</span>
        {name.slice(q.length)}
      </>
    );
  }
  return <>{name}</>;
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
      <ComboboxInputGroup className="min-w-0 flex-1">
        <ComboboxInput
          aria-label="Passport country"
          placeholder="Select nationality"
          className="h-11 border-0 bg-transparent px-0 text-base font-medium text-neutral-900 shadow-none placeholder:text-neutral-500 focus-visible:ring-0 sm:text-sm dark:bg-transparent"
        />
      </ComboboxInputGroup>
      <ComboboxPortal>
        <ComboboxPositioner>
          <ComboboxPopup className="rounded-2xl p-1.5 shadow-2xl ring-black/5">
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
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // The passport's own country is never a destination for that traveller.
  const suggestions = useMemo(
    () =>
      (value.trim() ? destinations.filter((d) => matchesDestination(d.code, value)) : destinations)
        .filter((d) => d.code !== passport)
        .slice(0, MAX_SUGGESTIONS),
    [destinations, value, passport]
  );

  function sameCountry(term: string, code: string | null) {
    if (!code) return false;
    const needle = term.trim().toLowerCase();
    return needle !== "" && (needle === code.toLowerCase() || needle === countryName(code).toLowerCase());
  }

  function go(term: string) {
    const trimmed = term.trim();
    if (sameCountry(trimmed, passport)) {
      setError(`Your passport and destination can't both be ${countryName(passport!)}.`);
      setOpen(false);
      return;
    }
    setError(null);
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
      className="relative"
    >
      <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_auto] md:gap-4">
        <div className="min-w-0 rounded-xl border border-[#dce5df] bg-[#f8faf8] px-4 py-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <span className="mb-1 flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-[#5c7468] uppercase"><BookUser className="size-3.5 text-primary" aria-hidden /> Passport nationality</span>
          <PassportField
            value={passport}
            onChange={(code) => {
              setPassport(code);
              setError(sameCountry(value, code) ? `Your passport and destination can't both be ${countryName(code!)}.` : null);
            }}
          />
        </div>
        <div className="relative min-w-0">
        <div className="min-w-0 rounded-xl border border-[#dce5df] bg-[#f8faf8] px-4 py-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <label htmlFor={`${listId}-destination`} className="mb-1 flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-[#5c7468] uppercase"><MapPin className="size-3.5 text-primary" aria-hidden /> Destination</label>
          <input
            id={`${listId}-destination`}
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            aria-label="Destination country"
            autoComplete="off"
            placeholder="Where would you like to go?"
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${listId}-error` : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setActive(-1);
              setOpen(true);
              if (error) setError(sameCountry(e.target.value, passport) ? error : null);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            className="h-11 w-full min-w-0 bg-transparent text-base font-medium text-neutral-900 outline-none placeholder:font-normal placeholder:text-neutral-500 sm:text-sm"
          />
        </div>
          {showList ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Destinations"
              className="absolute top-full right-0 left-0 z-30 mt-2 max-h-[22rem] min-w-72 origin-top animate-in overflow-y-auto rounded-2xl bg-white p-1.5 text-neutral-900 shadow-2xl ring-1 ring-black/5 duration-150 fade-in-0 zoom-in-95 slide-in-from-top-1"
            >
              {suggestions.length > 0 ? (
                <>
                  <li role="presentation" className="px-3 pt-2 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
                    {value.trim() ? "Matching destinations" : "Popular destinations"}
                  </li>
                  {suggestions.map((option, i) => (
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
                        "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                        i === active ? "bg-primary/10" : "hover:bg-neutral-50"
                      )}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-neutral-100 text-2xl leading-none ring-1 ring-black/5" aria-hidden>
                        {option.flag}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          <MatchedName name={option.name} query={value} />
                        </span>
                        <span className="block text-xs text-neutral-500">
                          {option.visaCount} {option.visaCount === 1 ? "visa type" : "visa types"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[10px] font-medium tracking-wide text-neutral-500 uppercase">From</span>
                        <span className="block text-sm font-semibold text-primary tabular-nums">
                          {option.currency} {option.fromPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                      </span>
                      <ArrowRight
                        className={cn(
                          "size-4 shrink-0 text-primary transition-all duration-150",
                          i === active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"
                        )}
                        aria-hidden
                      />
                    </li>
                  ))}
                </>
              ) : (
                <li className="flex items-center gap-2.5 px-3 py-3.5 text-sm text-neutral-500">
                  <SearchX className="size-4 shrink-0" aria-hidden /> No destination matches &ldquo;{value.trim()}&rdquo;
                </li>
              )}
            </ul>
          ) : null}
        </div>
        <button type="submit" className="flex min-h-14 items-center justify-center gap-3 rounded-xl bg-brand-accent px-7 text-sm font-semibold text-brand-accent-foreground shadow-sm transition-colors hover:bg-brand-accent/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          Find my visa <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>

      {error ? (
        <p
          id={`${listId}-error`}
          role="alert"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-destructive shadow-lg"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden /> {error}
        </p>
      ) : null}

    </form>
  );
}
