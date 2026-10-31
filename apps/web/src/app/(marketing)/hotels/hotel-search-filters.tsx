"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "@/components/marketing/travel-collection.module.css";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationField } from "@/components/location-field";
import { OccupancyPicker } from "@/modules/hotels/components/occupancy-picker";
import { formatOccupancy, occupancyTotals, parseOccupancy } from "@/modules/hotels/booking-options";

import { CalendarMonthIcon, PeopleAltIcon, PlaceIcon, SearchIcon } from "@/components/ui/mui-icons";
const today = new Date().toISOString().slice(0, 10);

export type HotelSearchValues = {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  occ: string;
};

const FIELD_LABEL = "flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground";
const FIELD_INPUT = "h-9 w-full border-0 bg-transparent p-0 text-sm font-semibold text-foreground shadow-none outline-none focus-visible:ring-0 dark:bg-transparent";

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
    if (values.occ) {
      params.set("occ", values.occ);
      params.set("guests", String(occupancyTotals(parseOccupancy(values.occ)).guests));
    } else if (values.guests) {
      params.set("guests", values.guests);
    }
    router.push(`/hotels${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={styles.searchForm}
    >
      <div className={styles.searchCell}>
        <Label htmlFor="city" className={FIELD_LABEL}>
          <PlaceIcon sx={{ fontSize: 14 }} aria-hidden /> Destination
        </Label>
        <div className="mt-0.5 [&_input]:h-9 [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0 [&_input]:text-base sm:[&_input]:text-sm [&_input]:font-semibold [&_input]:text-foreground [&_input]:shadow-none [&_input]:placeholder:text-muted-foreground [&_input]:focus-visible:ring-0">
          <LocationField
            id="city"
            placeholder="Enter a city"
            value={values.city}
            onChange={(city) => set("city", city)}
            icon={false}
          />
        </div>
      </div>

      <div className={styles.searchCell}>
        <Label htmlFor="checkIn" className={FIELD_LABEL}>
          <CalendarMonthIcon sx={{ fontSize: 14 }} aria-hidden /> Check-in
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

      <div className={styles.searchCell}>
        <Label htmlFor="checkOut" className={FIELD_LABEL}>
          <CalendarMonthIcon sx={{ fontSize: 14 }} aria-hidden /> Check-out
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

      <div className={styles.searchCell}>
        <Label htmlFor="guests" className={FIELD_LABEL}>
          <PeopleAltIcon sx={{ fontSize: 14 }} aria-hidden /> Guests
        </Label>
        <OccupancyPicker
          id="guests"
          name={null}
          value={parseOccupancy(values.occ, Number.parseInt(values.guests, 10) || undefined)}
          onChange={(rooms) => set("occ", formatOccupancy(rooms))}
          className="h-9 w-full justify-start border-0 bg-transparent px-0 text-sm font-semibold text-foreground shadow-none hover:border-0 focus-visible:ring-0 dark:bg-transparent [&_svg]:hidden"
        />
      </div>

      <button
        type="submit"
        className={styles.searchSubmit}
      >
        <SearchIcon sx={{ fontSize: 20 }} aria-hidden /> Find hotels
      </button>
    </form>
  );
}
