"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationField } from "@/components/location-field";

import { CalendarMonthIcon, PeopleAltIcon, PlaceIcon, SearchIcon } from "@/components/ui/mui-icons";
const today = new Date().toISOString().slice(0, 10);

export type HotelSearchValues = {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: string;
};

const CELL = "relative flex-1 px-4 py-2.5";
const FIELD_LABEL = "flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-white/70 uppercase";
const FIELD_INPUT =
  "h-9 w-full border-0 bg-transparent p-0 text-sm font-medium text-white shadow-none outline-none placeholder:text-white/50 focus-visible:ring-0 dark:bg-transparent [&::-webkit-calendar-picker-indicator]:invert";

/**
 * Translucent inline search bar that sits over the panoramic hero photo — one
 * connected dark-glass bar on desktop, stacked cells on mobile. City filters
 * server-side; dates/guests ride along to prefill the booking form.
 */
export function HotelSearchFilters({ initial }: { initial: HotelSearchValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);

  function set<K extends keyof HotelSearchValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (values.city) params.set("city", values.city);
    if (values.checkIn) params.set("checkIn", values.checkIn);
    if (values.checkOut) params.set("checkOut", values.checkOut);
    if (values.guests) params.set("guests", values.guests);
    router.push(`/hotels${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col overflow-hidden rounded-xl border border-white/20 bg-black/55 shadow-2xl backdrop-blur-md lg:flex-row lg:items-stretch"
    >
      <div className={CELL}>
        <Label htmlFor="city" className={FIELD_LABEL}>
          <PlaceIcon sx={{ fontSize: 14 }} /> Where
        </Label>
        {/* LocationField renders our Input primitive; strip its chrome so it
            reads as part of the glass bar rather than a nested box. */}
        <div className="mt-0.5 [&_input]:h-9 [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0 [&_input]:text-sm [&_input]:font-medium [&_input]:text-white [&_input]:shadow-none [&_input]:placeholder:text-white/50 [&_input]:focus-visible:ring-0">
          <LocationField
            id="city"
            placeholder="Enter a city"
            value={values.city}
            onChange={(city) => set("city", city)}
          />
        </div>
      </div>

      <div className="h-px bg-white/15 lg:h-auto lg:w-px" aria-hidden />

      <div className={CELL}>
        <Label htmlFor="checkIn" className={FIELD_LABEL}>
          <CalendarMonthIcon sx={{ fontSize: 14 }} /> Check-in
        </Label>
        <Input
          id="checkIn"
          type="date"
          autoComplete="off"
          min={today}
          value={values.checkIn}
          onChange={(e) => set("checkIn", e.target.value)}
          className={FIELD_INPUT}
        />
      </div>

      <div className="h-px bg-white/15 lg:h-auto lg:w-px" aria-hidden />

      <div className={CELL}>
        <Label htmlFor="checkOut" className={FIELD_LABEL}>
          <CalendarMonthIcon sx={{ fontSize: 14 }} /> Check-out
        </Label>
        <Input
          id="checkOut"
          type="date"
          autoComplete="off"
          min={values.checkIn || today}
          value={values.checkOut}
          onChange={(e) => set("checkOut", e.target.value)}
          className={FIELD_INPUT}
        />
      </div>

      <div className="h-px bg-white/15 lg:h-auto lg:w-px" aria-hidden />

      <div className={CELL}>
        <Label htmlFor="guests" className={FIELD_LABEL}>
          <PeopleAltIcon sx={{ fontSize: 14 }} /> Guests
        </Label>
        <Input
          id="guests"
          type="number"
          autoComplete="off"
          placeholder="2 guests"
          min={1}
          max={30}
          value={values.guests}
          onChange={(e) => set("guests", e.target.value)}
          className={FIELD_INPUT}
        />
      </div>

      <button
        type="submit"
        className="flex h-14 shrink-0 items-center justify-center gap-2 bg-brand-accent px-9 font-heading text-sm font-bold text-brand-accent-foreground transition-colors hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none lg:h-auto"
      >
        <SearchIcon sx={{ fontSize: 20 }} /> Search
      </button>
    </form>
  );
}
