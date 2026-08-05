"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const today = new Date().toISOString().slice(0, 10);

export type HotelSearchValues = {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: string;
};

/** Hero search card — city filters server-side; dates/guests prefill booking. */
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
      // The hero renders this card inside a dark section (text-sidebar-foreground);
      // reset back to the normal foreground so labels/input text stay legible on
      // this light card instead of inheriting the hero's light-on-dark color.
      className="grid grid-cols-1 gap-3 rounded-2xl bg-background/95 p-4 text-foreground shadow-lg sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] lg:items-end"
    >
      <div className="space-y-1.5">
        <Label htmlFor="city" className="flex items-center gap-1 text-xs">
          <MapPin className="size-3.5 text-primary" /> Destination
        </Label>
        <Input
          id="city"
          name="hotel-destination"
          autoComplete="off"
          placeholder="Mogadishu, Nairobi, Dubai…"
          value={values.city}
          onChange={(e) => set("city", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="checkIn" className="flex items-center gap-1 text-xs">
          <CalendarDays className="size-3.5 text-primary" /> Check-in
        </Label>
        <Input
          id="checkIn"
          type="date"
          autoComplete="off"
          min={today}
          value={values.checkIn}
          onChange={(e) => set("checkIn", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="checkOut" className="flex items-center gap-1 text-xs">
          <CalendarDays className="size-3.5 text-primary" /> Check-out
        </Label>
        <Input
          id="checkOut"
          type="date"
          autoComplete="off"
          min={values.checkIn || today}
          value={values.checkOut}
          onChange={(e) => set("checkOut", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="guests" className="flex items-center gap-1 text-xs">
          <Users className="size-3.5 text-primary" /> Guests
        </Label>
        <Input
          id="guests"
          type="number"
          autoComplete="off"
          placeholder="2"
          min={1}
          max={30}
          value={values.guests}
          onChange={(e) => set("guests", e.target.value)}
        />
      </div>
      <Button type="submit" size="lg" className="gap-1.5">
        <Search className="size-4" /> Search
      </Button>
    </form>
  );
}
