"use client";

import { useState } from "react";
import { ArrowLeftRight, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { countryFlag } from "@/lib/countries";
import type { Airport } from "@/modules/flights/queries";

export type FlightSearchDefaults = {
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  tripType?: string;
  adults?: string;
  cabin?: string;
};

function AirportSelect({
  name,
  airports,
  defaultValue,
  placeholder,
  id,
}: {
  name: string;
  airports: Airport[];
  defaultValue?: string;
  placeholder: string;
  id: string;
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger id={id} className="h-11 w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {airports.map((airport) => (
          <SelectItem key={airport.iata_code} value={airport.iata_code}>
            {countryFlag(airport.country_code)} {airport.city} ({airport.iata_code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** GET form — search state lives in the URL so results are shareable. */
export function FlightSearchForm({
  airports,
  defaults,
}: {
  airports: Airport[];
  defaults: FlightSearchDefaults;
}) {
  const [tripType, setTripType] = useState(defaults.tripType === "one_way" ? "one_way" : "round_trip");

  return (
    <form className="rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-6">
      <input type="hidden" name="trip_type" value={tripType} />
      <div className="flex gap-2">
        {(
          [
            ["round_trip", "Round Trip", ArrowLeftRight],
            ["one_way", "One Way", ArrowRight],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTripType(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              tripType === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <div className="space-y-1.5 lg:col-span-3">
          <Label htmlFor="origin">From</Label>
          <AirportSelect
            id="origin"
            name="origin"
            airports={airports}
            defaultValue={defaults.origin}
            placeholder="Departure city"
          />
        </div>
        <div className="space-y-1.5 lg:col-span-3">
          <Label htmlFor="destination">To</Label>
          <AirportSelect
            id="destination"
            name="destination"
            airports={airports}
            defaultValue={defaults.destination}
            placeholder="Destination city"
          />
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="depart_date">Departure</Label>
          <Input
            id="depart_date"
            name="depart_date"
            type="date"
            autoComplete="off"
            className="h-11"
            defaultValue={defaults.departDate}
            required
          />
        </div>
        {tripType === "round_trip" ? (
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="return_date">Return</Label>
            <Input
              id="return_date"
              name="return_date"
              type="date"
              autoComplete="off"
              className="h-11"
              defaultValue={defaults.returnDate}
            />
          </div>
        ) : null}
        <div className="space-y-1.5 lg:col-span-1">
          <Label htmlFor="adults">Travelers</Label>
          <Input
            id="adults"
            name="adults"
            type="number"
            autoComplete="off"
            min={1}
            max={9}
            className="h-11"
            defaultValue={defaults.adults ?? "1"}
          />
        </div>
        <div className={cn("space-y-1.5", tripType === "round_trip" ? "lg:col-span-1" : "lg:col-span-3")}>
          <Label htmlFor="cabin">Cabin</Label>
          <Select name="cabin" defaultValue={defaults.cabin ?? "economy"}>
            <SelectTrigger id="cabin" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="economy">Economy</SelectItem>
              <SelectItem value="premium_economy">Premium Economy</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="first">First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="submit" size="lg" className="gap-2 px-8">
          <Search className="size-4" /> Search Flights
        </Button>
      </div>
    </form>
  );
}
