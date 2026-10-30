"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useId } from "react";
import { StarIcon, TuneIcon } from "@/components/ui/mui-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
    <div className="border-b border-border px-5 py-5 last:border-b-0">
      <h3 className="mb-3 text-xs font-semibold">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

type HotelFiltersProps = {
  /** Distinct amenity keys present in the current result set, with labels. */
  amenities: Array<{ key: string; label: string; count: number }>;
  counts: { stars: Record<string, number>; price: Record<string, number> };
};

const FILTER_PARAMS = ["stars", "price", "amenities"];

/**
 * Phone/tablet entry point: the same filter panel in a left-hand sheet, so results start right under the search instead of below a tall
 * sidebar. Below lg only; the page renders the inline panel from lg up.
 */
export function HotelFiltersSheet(props: HotelFiltersProps) {
  const searchParams = useSearchParams();
  const activeCount = FILTER_PARAMS.reduce(
    (sum, p) => sum + (searchParams.get(p) ?? "").split(",").filter(Boolean).length,
    0
  );

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="lg" className="gap-2 lg:hidden" />}>
        <TuneIcon sx={{ fontSize: 18 }} aria-hidden />
        Filters
        {activeCount > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
            {activeCount}
          </span>
        ) : null}
      </SheetTrigger>
      <SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <HotelFilters {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function HotelFilters({ amenities, counts }: HotelFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Multi-select params are stored comma-separated so they stay readable.
  const toggle = useCallback(
    (param: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
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

  const filterId = useId();

  const isOn = (param: string, value: string) =>
    (searchParams.get(param) ?? "").split(",").filter(Boolean).includes(value);

  const activeCount =
    FILTER_PARAMS.reduce(
      (sum, p) => sum + (searchParams.get(p) ?? "").split(",").filter(Boolean).length,
      0
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          Refine your stay
        </h2>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              FILTER_PARAMS.forEach((p) => params.delete(p));
              params.delete("page");
              router.push(`${pathname}?${params.toString()}`, { scroll: false });
            }}
            className="-my-2 rounded-sm px-1 py-2 text-xs font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
            <div key={stars} className="flex min-h-8 items-center gap-2.5">
              <Checkbox
                id={`${filterId}-stars-${stars}`}
                aria-label={`${stars} star hotels`}
                checked={isOn("stars", value)}
                onCheckedChange={() => toggle("stars", value)}
                disabled={count === 0}
              />
              <Label
                htmlFor={`${filterId}-stars-${stars}`}
                className={cn("flex flex-1 cursor-pointer items-center gap-1 text-sm", count === 0 && "opacity-40")}
              >
                <span className="sr-only">{stars} star</span>
                <span className="flex" aria-hidden>
                  {Array.from({ length: stars }).map((_, i) => (
                    <StarIcon key={i} sx={{ fontSize: 14 }} className="text-brand-gold" />
                  ))}
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
              </Label>
            </div>
          );
        })}
      </FilterGroup>

      <FilterGroup title="Price per night">
        {PRICE_BANDS.map((band) => {
          const count = counts.price[band.key] ?? 0;
          return (
            <div key={band.key} className="flex min-h-8 items-center gap-2.5">
              <Checkbox
                id={`${filterId}-price-${band.key}`}
                aria-label={band.label}
                checked={isOn("price", band.key)}
                onCheckedChange={() => toggle("price", band.key)}
                disabled={count === 0}
              />
              <Label
                htmlFor={`${filterId}-price-${band.key}`}
                className={cn("flex flex-1 cursor-pointer text-sm", count === 0 && "opacity-40")}
              >
                {band.label}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
              </Label>
            </div>
          );
        })}
      </FilterGroup>

      {amenities.length > 0 ? (
        <FilterGroup title="Facilities">
          {amenities.slice(0, 8).map((amenity) => (
            <div key={amenity.key} className="flex min-h-8 items-center gap-2.5">
              <Checkbox
                id={`${filterId}-amenity-${amenity.key}`}
                aria-label={amenity.label}
                checked={isOn("amenities", amenity.key)}
                onCheckedChange={() => toggle("amenities", amenity.key)}
              />
              <Label htmlFor={`${filterId}-amenity-${amenity.key}`} className="flex flex-1 cursor-pointer text-sm">
                {amenity.label}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{amenity.count}</span>
              </Label>
            </div>
          ))}
        </FilterGroup>
      ) : null}
    </div>
  );
}
