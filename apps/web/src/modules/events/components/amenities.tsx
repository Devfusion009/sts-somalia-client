import {
  Armchair,
  Baby,
  Car,
  ChefHat,
  DoorOpen,
  Languages,
  MonitorPlay,
  Moon,
  Presentation,
  Projector,
  Sofa,
  Speaker,
  Sparkles,
  Tent,
  Trees,
  UtensilsCrossed,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Known amenity keys → icon + label; unknown keys fall back to a formatted key. */
const AMENITY_MAP: Record<string, { icon: LucideIcon; label: string }> = {
  stage: { icon: Presentation, label: "Stage" },
  led_screens: { icon: MonitorPlay, label: "LED Screens" },
  sound_system: { icon: Speaker, label: "Sound System" },
  catering_kitchen: { icon: ChefHat, label: "Catering Kitchen" },
  catering_service: { icon: UtensilsCrossed, label: "Catering Service" },
  bridal_suite: { icon: Sparkles, label: "Bridal Suite" },
  vip_lounge: { icon: Sofa, label: "VIP Lounge" },
  parking: { icon: Car, label: "On-site Parking" },
  generator_backup: { icon: Zap, label: "Generator Backup" },
  prayer_rooms: { icon: Moon, label: "Prayer Rooms" },
  projector: { icon: Projector, label: "Projector" },
  translation_booths: { icon: Languages, label: "Translation Booths" },
  breakout_rooms: { icon: DoorOpen, label: "Breakout Rooms" },
  high_speed_wifi: { icon: Wifi, label: "High-speed Wi-Fi" },
  garden: { icon: Trees, label: "Garden" },
  covered_pavilion: { icon: Tent, label: "Covered Pavilion" },
  kids_area: { icon: Baby, label: "Kids Area" },
};

export function amenityInfo(key: string): { icon: LucideIcon; label: string } {
  return (
    AMENITY_MAP[key] ?? {
      icon: Armchair,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    }
  );
}

export { EVENT_TYPE_LABELS, eventTypeLabel } from "@sts/shared-types";

/** "USD 400.50", "USD 1,200" — cents only when there are any. */
export function venueMoney(currency: string, amount: number | string) {
  const n = Number(amount);
  return `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function priceUnitLabel(unit: string) {
  switch (unit) {
    case "per_day":
      return "per day";
    case "per_hour":
      return "per hour";
    case "per_person":
      return "per person";
    default:
      return "per event";
  }
}
