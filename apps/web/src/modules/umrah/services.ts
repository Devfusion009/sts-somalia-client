import {
  BedDouble,
  Bus,
  Plane,
  Sparkles,
  Stamp,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import type { Database } from "@/lib/types/database.types";

export type UmrahServiceCategory = Database["public"]["Enums"]["umrah_service_category"];
export type UmrahPriceUnit = Database["public"]["Enums"]["umrah_price_unit"];
export type UmrahTier = Database["public"]["Enums"]["umrah_tier"];

/**
 * The private-builder category configuration — the single source of truth for
 * what a customer may choose, in what order, and how many options they may
 * take from each group. It lives in TypeScript rather than in the database
 * for the same reason UMRAH_INCLUDE_OPTIONS does (see includes.ts): the app
 * has to render each category with its own copy, icon and selection rule, so
 * a category nothing knows how to render must not be creatable.
 *
 * `selection`:
 *   single — pick at most one. Two Makkah hotels, or a bus AND a train for
 *            the same leg, is not a configuration a customer can want.
 *   multi  — an add-on bucket; take as many as you like.
 *
 * `nights` says which stay drives per-night pricing: a Makkah hotel is priced
 * over the Makkah nights, while a full-board meal plan spans the whole trip.
 */
export type UmrahCategoryConfig = {
  value: UmrahServiceCategory;
  label: string;
  /** Shown under the heading in the builder. */
  hint: string;
  icon: LucideIcon;
  selection: "single" | "multi";
  nights: "makkah" | "madinah" | "trip";
  /** Hotels are only required when the customer is actually staying there. */
  requiredWhen?: "nights_makkah" | "nights_madinah";
};

export const UMRAH_CATEGORIES: UmrahCategoryConfig[] = [
  {
    value: "hotel_makkah",
    label: "Hotel in Makkah",
    hint: "Priced per person, per night, on a sharing basis.",
    icon: BedDouble,
    selection: "single",
    nights: "makkah",
    requiredWhen: "nights_makkah",
  },
  {
    value: "hotel_madinah",
    label: "Hotel in Madinah",
    hint: "Priced per person, per night, on a sharing basis.",
    icon: BedDouble,
    selection: "single",
    nights: "madinah",
    requiredWhen: "nights_madinah",
  },
  {
    value: "flight",
    label: "Flights",
    hint: "Return airfare from Somalia to Jeddah.",
    icon: Plane,
    selection: "single",
    nights: "trip",
  },
  {
    value: "visa",
    label: "Umrah visa",
    hint: "Leave this out only if you already hold a valid visa.",
    icon: Stamp,
    selection: "single",
    nights: "trip",
  },
  {
    value: "transport",
    label: "Ground transport",
    hint: "Airport transfers and getting around in each city.",
    icon: Bus,
    selection: "single",
    nights: "trip",
  },
  {
    value: "intercity",
    label: "Makkah ↔ Madinah transfer",
    hint: "One journey between the two cities — bus, Haramain train, or a private VIP car.",
    icon: TrainFront,
    selection: "single",
    nights: "trip",
  },
  {
    value: "extra",
    label: "Additional services",
    hint: "Optional extras. Take as many as you like.",
    icon: Sparkles,
    selection: "multi",
    nights: "trip",
  },
];

export const UMRAH_CATEGORY_BY_VALUE = new Map(UMRAH_CATEGORIES.map((c) => [c.value, c]));

export function categoryLabel(category: UmrahServiceCategory): string {
  return UMRAH_CATEGORY_BY_VALUE.get(category)?.label ?? category;
}

export const UMRAH_TIERS: { value: UmrahTier; label: string; blurb: string; className: string }[] = [
  {
    value: "basic",
    label: "Basic",
    blurb: "Comfortable, well-run hotels with a shuttle to the Haram. The most affordable way to go.",
    className: "bg-chart-3/10 text-chart-3",
  },
  {
    value: "standard",
    label: "Standard",
    blurb: "Walking distance to the Haram, 4-star hotels, and the Haramain train between cities.",
    className: "bg-chart-2/10 text-chart-2",
  },
  {
    value: "premium",
    label: "Premium",
    blurb: "5-star hotels at the Haram's doorstep, private transport, and the shortest walks.",
    className: "bg-brand-gold/15 text-brand-gold",
  },
];

export const UMRAH_TIER_LABELS: Record<string, string> = Object.fromEntries(
  UMRAH_TIERS.map((t) => [t.value, t.label])
);

/** Each tier's badge colours, keyed the same way — a chip anyone can build without re-deriving the class string. */
export const UMRAH_TIER_CHIP_CLASS: Record<string, string> = Object.fromEntries(
  UMRAH_TIERS.map((t) => [t.value, t.className])
);

export const PRICE_UNIT_LABELS: Record<UmrahPriceUnit, string> = {
  per_person: "per person",
  per_person_per_night: "per person, per night",
  per_night: "per night",
  per_booking: "for the whole party",
};

/** One row of the admin-priced catalog, as the builder consumes it. */
export type UmrahService = {
  id: string;
  category: UmrahServiceCategory;
  name: string;
  description: string | null;
  tier: UmrahTier | null;
  price: number;
  currency: string;
  price_unit: UmrahPriceUnit;
  star_rating: number | null;
  distance_to_haram_m: number | null;
  is_default: boolean;
  sort_order: number;
};
