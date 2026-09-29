"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VISA_COUNTRIES = [
  "UAE",
  "Saudi Arabia",
  "Turkey",
  "Kenya",
  "Ethiopia",
  "Egypt",
  "Qatar",
  "Malaysia",
];

/** flag-icons (already a dependency) country codes for the popular chips. */
const POPULAR: Array<{ country: string; fi: string }> = [
  { country: "UAE", fi: "fi-ae" },
  { country: "Saudi Arabia", fi: "fi-sa" },
  { country: "Turkey", fi: "fi-tr" },
  { country: "Kenya", fi: "fi-ke" },
];

export function VisaCountryPicker() {
  const router = useRouter();
  const [country, setCountry] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
      <Label htmlFor="visa-teaser-country" className="text-sm font-semibold text-sidebar-foreground">
        Where are you going?
      </Label>
      <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row">
        <Select value={country} onValueChange={(value) => setCountry(value ? String(value) : null)}>
          <SelectTrigger
            id="visa-teaser-country"
            className="h-12 w-full border-white/20 bg-white/10 text-sidebar-foreground data-placeholder:text-sidebar-foreground/60 dark:bg-white/10 dark:hover:bg-white/15 [&_svg:not([class*='text-'])]:text-sidebar-foreground/70"
          >
            <SelectValue placeholder="Choose a country" />
          </SelectTrigger>
          <SelectContent>
            {VISA_COUNTRIES.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          disabled={!country}
          onClick={() => country && router.push(`/visa?country=${encodeURIComponent(country)}`)}
          className="h-12 shrink-0 bg-brand-accent px-6 font-semibold text-brand-accent-foreground hover:bg-brand-accent/90"
        >
          Check requirements
          <ArrowRight aria-hidden />
        </Button>
      </div>

      <p className="mt-5 text-xs font-semibold text-sidebar-foreground/60">
        Most requested
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {POPULAR.map((item) => (
          <Link
            key={item.country}
            href={`/visa?country=${encodeURIComponent(item.country)}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:border-sidebar-primary/60 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            <span className={`fi ${item.fi} rounded-xs`} aria-hidden />
            {item.country}
          </Link>
        ))}
      </div>
    </div>
  );
}
