import { Plane, Stamp, BedDouble, Bus, UtensilsCrossed, MapPin, UserCheck, type LucideIcon } from "lucide-react";

/**
 * The single source of truth for what an Umrah package's "includes" list can
 * contain. Previously the admin form was a free-text "one per line" textarea
 * (any string could end up in umrah_packages.includes), while the public
 * detail page only rendered a token if it matched one of 7 hardcoded keys —
 * a typo or a token outside that set silently rendered nothing. The admin
 * form now offers exactly these 7 as checkboxes, so an unrenderable include
 * can no longer be saved.
 */
export type UmrahIncludeKey =
  | "flights"
  | "visa"
  | "hotel"
  | "transport"
  | "meals"
  | "ziyarat_tours"
  | "private_guide";

export const UMRAH_INCLUDE_OPTIONS: {
  value: UmrahIncludeKey;
  shortLabel: string;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  { value: "flights", shortLabel: "Flights", label: "Return Flights", description: "From Mogadishu or Hargeisa", icon: Plane },
  { value: "visa", shortLabel: "Visa", label: "Umrah Visa", description: "Processing handled by STS", icon: Stamp },
  { value: "hotel", shortLabel: "Hotel", label: "Hotel Accommodation", description: "In Makkah & Madinah", icon: BedDouble },
  { value: "transport", shortLabel: "Transport", label: "Ground Transport", description: "Airport & inter-city transfers", icon: Bus },
  // Description deliberately generic: the board level differs per package
  // (half board vs full board) and is stated exactly once, by the Food section
  // reading umrah_packages.meal_plan. Hardcoding "breakfast & dinner" here
  // contradicted every full-board package on the same screen.
  { value: "meals", shortLabel: "Meals", label: "Meals", description: "Included — see Food below", icon: UtensilsCrossed },
  { value: "ziyarat_tours", shortLabel: "Ziyarat", label: "Guided Ziyarat", description: "Historic sites with a guide", icon: MapPin },
  { value: "private_guide", shortLabel: "Private Guide", label: "Private Guide", description: "Dedicated personal guide", icon: UserCheck },
];

export const UMRAH_INCLUDE_KEYS = UMRAH_INCLUDE_OPTIONS.map((o) => o.value);

/** Short chip labels, for the package card grid. */
export const INCLUDE_LABELS: Record<string, string> = Object.fromEntries(
  UMRAH_INCLUDE_OPTIONS.map((o) => [o.value, o.shortLabel])
);

/** Full label + description + icon, for the "What's included" section on the package page. */
export const INCLUDE_DETAILS: Record<string, { label: string; description: string; icon: LucideIcon }> = Object.fromEntries(
  UMRAH_INCLUDE_OPTIONS.map((o) => [o.value, { label: o.label, description: o.description, icon: o.icon }])
);
