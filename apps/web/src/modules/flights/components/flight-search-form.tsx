"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  CalendarMonthIcon,
  CloseIcon,
  PersonIcon,
  SearchIcon,
  SwapHorizIcon,
} from "@/components/ui/mui-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
} from "@/components/ui/combobox";
import { countryName } from "@/lib/countries";
import type { Airport } from "@sts/shared-types";

export type FlightSearchDefaults = {
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  tripType?: string;
  adults?: string;
  cabin?: string;
};

const CABINS = [
  { value: "economy", label: "Economy" },
  { value: "premium_economy", label: "Premium Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
];

/** Bare cell inside the white pill — no borders of its own, just padding. */
const CELL = "relative min-w-0 px-4 py-3.5";
const RESET_INPUT =
  "h-8 w-full border-0 bg-transparent p-0 text-base font-semibold text-foreground sm:text-sm shadow-none outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-0 cursor-pointer " +
  // The native calendar-picker icon stays clickable but invisible, stretched
  // over the whole field — one visible icon (ours) instead of two competing
  // ones, and the field is clickable anywhere, not just on a tiny glyph.
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

type Place = { code: string; label: string; country: string };

const placeText = (p: Place) => `${p.label} (${p.code})`;

function airportToPlace(a: Airport): Place {
  return { code: a.iata_code, label: a.city, country: countryName(a.country_code) };
}

/**
 * Type-ahead airport/city picker. With nothing typed it lists the local
 * shortlist; from 2 characters on it queries /api/places/airports, and falls
 * back to filtering the shortlist if that lookup returns nothing.
 */
function AirportPicker({
  id,
  name,
  airports,
  value,
  onValueChange,
  placeholder,
}: {
  id: string;
  name: string;
  airports: Airport[];
  value: Place | null;
  onValueChange: (v: Place | null) => void;
  placeholder: string;
}) {
  const shortlist = useMemo(() => airports.map(airportToPlace), [airports]);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<{ term: string; places: Place[] } | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/airports?input=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { places?: Place[] };
        setRemote({ term, places: data.places ?? [] });
      } catch {
        // aborted or offline — keep whatever is showing
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return shortlist;
    if (remote && remote.term === query.trim() && remote.places.length > 0) return remote.places;
    return shortlist.filter((p) => `${p.label} ${p.code}`.toLowerCase().includes(term));
  }, [query, remote, shortlist]);

  return (
    <>
      <input type="hidden" name={name} value={value?.code ?? ""} />
      <Combobox
        items={items}
        filter={null}
        value={value}
        onValueChange={(next) => onValueChange(next ?? null)}
        inputValue={query}
        onInputValueChange={setQuery}
        itemToStringLabel={placeText}
        isItemEqualToValue={(a, b) => a.code === b.code}
        autoHighlight
      >
        {value ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-secondary py-1 pr-1 pl-2 text-sm font-semibold text-secondary-foreground">
            <span className="truncate">{placeText(value)}</span>
            <button
              type="button"
              onClick={() => {
                onValueChange(null);
                setQuery("");
              }}
              aria-label={`Clear ${placeholder}`}
              className="grid size-6 shrink-0 place-items-center rounded text-secondary-foreground/70 transition-colors hover:bg-black/10 hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <CloseIcon sx={{ fontSize: 14 }} aria-hidden />
            </button>
          </span>
        ) : (
          <ComboboxInput
            id={id}
            placeholder={placeholder}
            autoComplete="off"
            className="h-8 rounded-none border-0 bg-transparent p-0 text-base font-semibold shadow-none placeholder:font-normal focus-visible:ring-0 sm:text-sm dark:bg-transparent"
          />
        )}
        <ComboboxPortal>
          <ComboboxPositioner className="z-[60]">
            <ComboboxPopup className="min-w-72">
              <ComboboxEmpty>No matching airports.</ComboboxEmpty>
              <ComboboxList>
                {(place: Place) => (
                  <ComboboxItem key={place.code} value={place}>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{placeText(place)}</span>
                      {place.country ? (
                        <span className="truncate text-xs text-muted-foreground">{place.country}</span>
                      ) : null}
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </Combobox>
    </>
  );
}

function resolveDefault(code: string | undefined, airports: Airport[]): Place | null {
  if (!code) return null;
  const local = airports.find((a) => a.iata_code === code);
  return local ? airportToPlace(local) : { code, label: code, country: "" };
}

/**
 * Single white search pill: trip type sits above it, everything else lives on
 * one row separated by hairlines, with the accent Search button flush to the
 * right end. Still a plain GET form, so results stay shareable via the URL.
 */
export function FlightSearchForm({
  airports,
  defaults,
}: {
  airports: Airport[];
  defaults: FlightSearchDefaults;
}) {
  const [tripType, setTripType] = useState(defaults.tripType === "one_way" ? "one_way" : "round_trip");
  const [origin, setOrigin] = useState<Place | null>(() => resolveDefault(defaults.origin, airports));
  const [destination, setDestination] = useState<Place | null>(() => resolveDefault(defaults.destination, airports));

  // A code from the URL that isn't in the local shortlist (e.g. CCU) shows as a
  // bare code until the lookup names it.
  useEffect(() => {
    for (const [current, set] of [
      [origin, setOrigin],
      [destination, setDestination],
    ] as const) {
      if (!current || current.label !== current.code) continue;
      fetch(`/api/places/airports?input=${encodeURIComponent(current.code)}`)
        .then((r) => r.json() as Promise<{ places?: Place[] }>)
        .then((d) => {
          const hit = d.places?.find((p) => p.code === current.code);
          if (hit) set(hit);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [adults, setAdults] = useState(defaults.adults ?? "1");
  const [departDate, setDepartDate] = useState(defaults.departDate ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const [cabin, setCabin] = useState(defaults.cabin ?? "economy");
  const roundTrip = tripType === "round_trip";
  const cabinLabel = CABINS.find((c) => c.value === cabin)?.label ?? "Economy";

  return (
    <form className="w-full">
      <input type="hidden" name="trip_type" value={tripType} />
      <input type="hidden" name="adults" value={adults} />
      <input type="hidden" name="cabin" value={cabin} />

      {/* One white card: trip type on top, fields below — a single surface
          rather than a dropdown floating on the dark canvas plus a
          separate pill. */}
      <div className="overflow-hidden rounded-2xl bg-card shadow-2xl shadow-black/30 ring-1 ring-black/[0.04]">
        <RadioGroup
          value={tripType}
          onValueChange={(v) => setTripType(v === "one_way" ? "one_way" : "round_trip")}
          aria-label="Trip type"
          className="flex w-auto items-center gap-6 border-b border-border px-5 py-3"
        >
          <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
            <RadioGroupItem value="one_way" />
            One way
          </label>
          <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
            <RadioGroupItem value="round_trip" />
            Return
          </label>
        </RadioGroup>

        <div className="flex flex-col lg:flex-row lg:items-stretch">
        <div className={cn(CELL, "lg:flex-1 lg:pl-5")}>
          <label htmlFor="origin" className="mb-0.5 block text-xs font-medium text-muted-foreground">
            From
          </label>
          <AirportPicker
            id="origin"
            name="origin"
            airports={airports}
            value={origin}
            onValueChange={setOrigin}
            placeholder="Departure city"
          />
        </div>

        {/* Swap straddles the divider between From and To */}
        <div className="relative flex items-center justify-center lg:w-0">
          <span className="hidden h-11 w-px bg-border lg:block" aria-hidden />
          <button
            type="button"
            onClick={() => {
              setOrigin(destination);
              setDestination(origin);
            }}
            aria-label="Swap departure and destination"
            className="z-10 grid size-9 place-items-center rounded-full border border-border bg-card text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:absolute"
          >
            <SwapHorizIcon sx={{ fontSize: 18 }} aria-hidden />
          </button>
        </div>

        <div className={cn(CELL, "lg:flex-1 lg:pl-6")}>
          <label htmlFor="destination" className="mb-0.5 block text-xs font-medium text-muted-foreground">
            To
          </label>
          <AirportPicker
            id="destination"
            name="destination"
            airports={airports}
            value={destination}
            onValueChange={setDestination}
            placeholder="Where to?"
          />
        </div>

        </div>

        <div className="grid grid-cols-2 border-t border-border lg:grid-cols-[1fr_1fr_1.25fr_auto]">
        <div className={cn(CELL, "lg:pl-5")}>
          <label htmlFor="depart_date" className="mb-0.5 block text-xs font-medium text-muted-foreground">
            Departure
          </label>
          <div className="flex items-center gap-1.5">
            <CalendarMonthIcon sx={{ fontSize: 16 }} className="shrink-0 text-muted-foreground" aria-hidden />
            <input
              id="depart_date"
              name="depart_date"
              type="date"
              autoComplete="off"
              required
              min={today}
              defaultValue={defaults.departDate}
              onChange={(e) => setDepartDate(e.target.value)}
              className={RESET_INPUT}
            />
          </div>
        </div>

        <div className={cn(CELL, "border-l border-border", !roundTrip && "opacity-40")}>
          <label htmlFor="return_date" className="mb-0.5 block text-xs font-medium text-muted-foreground">
            Return
          </label>
          <div className="flex items-center gap-1.5">
            <CalendarMonthIcon sx={{ fontSize: 16 }} className="shrink-0 text-muted-foreground" aria-hidden />
            <input
              id="return_date"
              name="return_date"
              type="date"
              autoComplete="off"
              disabled={!roundTrip}
              min={departDate || today}
              defaultValue={defaults.returnDate}
              className={RESET_INPUT}
            />
          </div>
        </div>

        {/* Travellers + cabin — one popover, one trigger, so every pixel of
            the cell (icon included) opens the same panel instead of two
            adjacent selects with a dead zone between them. */}
        <div className={cn(CELL, "col-span-2 border-t border-border lg:col-span-1 lg:border-t-0 lg:border-l")}>
          <span className="mb-0.5 block text-xs font-medium text-muted-foreground">
            Travellers
          </span>
          <Popover>
            <PopoverTrigger aria-label={`Travellers: ${adults} ${adults === "1" ? "adult" : "adults"}, ${cabinLabel}`} className="flex h-8 w-full items-center gap-1.5 rounded-md text-left text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none">
              <PersonIcon sx={{ fontSize: 16 }} className="shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">
                {adults} {adults === "1" ? "adult" : "adults"}, {cabinLabel}
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 gap-4 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Adults</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAdults((n) => String(Math.max(1, Number(n) - 1)))}
                    disabled={adults === "1"}
                    aria-label="Fewer adults"
                    className="grid size-9 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                  <span className="w-4 text-center text-sm font-semibold tabular-nums">{adults}</span>
                  <button
                    type="button"
                    onClick={() => setAdults((n) => String(Math.min(9, Number(n) + 1)))}
                    disabled={adults === "9"}
                    aria-label="More adults"
                    className="grid size-9 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-border pt-4">
                <label htmlFor="cabin-select" className="text-sm font-medium text-foreground">
                  Cabin class
                </label>
                <Select value={cabin} onValueChange={(v) => setCabin(String(v ?? "economy"))}>
                  <SelectTrigger id="cabin-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CABINS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="col-span-2 p-2 lg:col-span-1 lg:flex lg:items-center lg:p-2">
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-accent px-8 font-heading text-base font-bold text-brand-accent-foreground shadow-md shadow-brand-accent/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-accent/90 hover:shadow-lg hover:shadow-brand-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none lg:h-[3.25rem] lg:min-w-44"
          >
            <SearchIcon sx={{ fontSize: 20 }} aria-hidden />
            Search
          </button>
        </div>
        </div>
      </div>
    </form>
  );
}
