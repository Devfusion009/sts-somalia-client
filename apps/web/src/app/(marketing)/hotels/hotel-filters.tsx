"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { StarIcon, TuneIcon } from "@/components/ui/mui-icons";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PRICE_BANDS } from "@/modules/hotels/price-bands";

/**
 * Results sidebar. Every control here maps to a real column on the hotel record
 * (`star_rating`, `minPrice`, `amenities`) and writes to the URL, so filters are
 * shareable and the server does the filtering.
 *
 * Deliberately NOT included: a review-score filter. The reference site leads
 * with one, but this platform has no review data yet, and a control that
 * silently does nothing is worse than an absent one.
 */

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-4 last:border-b-0">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

export function HotelFilters({
  amenities,
  counts,
}: {
  /** Distinct amenity keys present in the current result set, with labels. */
  amenities: Array<{ key: string; label: string; count: number }>;
  counts: { stars: Record<string, number>; price: Record<string, number> };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Multi-select params are stored comma-separated so they stay readable.
  const toggle = useCallback(
    (param: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = (params.get(param) ?? "").split(",").filter(Boolean);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (next.length) params.set(param, next.join(","));
      else params.delete(param);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const isOn = (param: string, value: string) =>
    (searchParams.get(param) ?? "").split(",").filter(Boolean).includes(value);

  const activeCount =
    ["stars", "price", "amenities"].reduce(
      (sum, p) => sum + (searchParams.get(p) ?? "").split(",").filter(Boolean).length,
      0
    );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <TuneIcon sx={{ fontSize: 18 }} className="text-primary" />
          Filter by
        </h2>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              ["stars", "price", "amenities"].forEach((p) => params.delete(p));
              router.push(`${pathname}?${params.toString()}`, { scroll: false });
            }}
            className="text-xs font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <FilterGroup title="Star rating">
        {[5, 4, 3, 2, 1].map((stars) => {
          const value = String(stars);
          const count = counts.stars[value] ?? 0;
          return (
            <div key={stars} className="flex items-center gap-2.5">
              <Checkbox
                id={`stars-${stars}`}
                checked={isOn("stars", value)}
                onCheckedChange={() => toggle("stars", value)}
                disabled={count === 0}
              />
              <Label
                htmlFor={`stars-${stars}`}
                className={cn("flex flex-1 cursor-pointer items-center gap-1 text-sm", count === 0 && "opacity-40")}
              >
                <span className="flex" aria-label={`${stars} star`}>
                  {Array.from({ length: stars }).map((_, i) => (
                    <StarIcon key={i} sx={{ fontSize: 14 }} className="text-brand-gold" />
                  ))}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{count}</span>
              </Label>
            </div>
          );
        })}
      </FilterGroup>

      <FilterGroup title="Price per night">
        {PRICE_BANDS.map((band) => {
          const count = counts.price[band.key] ?? 0;
          return (
            <div key={band.key} className="flex items-center gap-2.5">
              <Checkbox
                id={`price-${band.key}`}
                checked={isOn("price", band.key)}
                onCheckedChange={() => toggle("price", band.key)}
                disabled={count === 0}
              />
              <Label
                htmlFor={`price-${band.key}`}
                className={cn("flex flex-1 cursor-pointer text-sm", count === 0 && "opacity-40")}
              >
                {band.label}
                <span className="ml-auto text-xs text-muted-foreground">{count}</span>
              </Label>
            </div>
          );
        })}
      </FilterGroup>

      {amenities.length > 0 ? (
        <FilterGroup title="Facilities">
          {amenities.slice(0, 8).map((amenity) => (
            <div key={amenity.key} className="flex items-center gap-2.5">
              <Checkbox
                id={`amenity-${amenity.key}`}
                checked={isOn("amenities", amenity.key)}
                onCheckedChange={() => toggle("amenities", amenity.key)}
              />
              <Label htmlFor={`amenity-${amenity.key}`} className="flex flex-1 cursor-pointer text-sm">
                {amenity.label}
                <span className="ml-auto text-xs text-muted-foreground">{amenity.count}</span>
              </Label>
            </div>
          ))}
        </FilterGroup>
      ) : null}
    </div>
  );
}
