import { BedDouble, Bus, Plane, Sparkles, Stamp, TrainFront, type LucideIcon } from "lucide-react";
import {
  UMRAH_CATEGORIES as BASE_CATEGORIES,
  UMRAH_TIERS as BASE_TIERS,
  type UmrahCategoryConfig as BaseCategoryConfig,
  type UmrahServiceCategory,
  type UmrahTier,
} from "@sts/shared-types";

export {
  categoryLabel,
  ROOM_SHARING_OPTIONS,
  ROOM_SHARING_LABELS,
  PRICE_UNIT_LABELS,
  UMRAH_TIER_LABELS,
  type UmrahServiceCategory,
  type UmrahPriceUnit,
  type UmrahTier,
  type RoomSharing,
  type UmrahService,
} from "@sts/shared-types";

/** The shared category config, plus the icon each category renders with. */
export type UmrahCategoryConfig = BaseCategoryConfig & { icon: LucideIcon };

const CATEGORY_ICON: Record<UmrahServiceCategory, LucideIcon> = {
  hotel_makkah: BedDouble,
  hotel_madinah: BedDouble,
  flight: Plane,
  visa: Stamp,
  transport: Bus,
  intercity: TrainFront,
  extra: Sparkles,
};

export const UMRAH_CATEGORIES: UmrahCategoryConfig[] = BASE_CATEGORIES.map((c) => ({ ...c, icon: CATEGORY_ICON[c.value] }));

export const UMRAH_CATEGORY_BY_VALUE = new Map(UMRAH_CATEGORIES.map((c) => [c.value, c]));

const TIER_CLASS: Record<UmrahTier, string> = {
  basic: "bg-chart-3/10 text-chart-3",
  standard: "bg-chart-2/10 text-chart-2",
  premium: "bg-brand-gold/15 text-brand-gold",
};

export const UMRAH_TIERS: { value: UmrahTier; label: string; blurb: string; className: string }[] = BASE_TIERS.map((t) => ({
  ...t,
  className: TIER_CLASS[t.value],
}));

/** Each tier's badge colours, keyed the same way. */
export const UMRAH_TIER_CHIP_CLASS: Record<string, string> = Object.fromEntries(UMRAH_TIERS.map((t) => [t.value, t.className]));
