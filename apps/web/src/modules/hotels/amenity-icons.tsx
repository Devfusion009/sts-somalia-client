import {
  AcUnitIcon,
  AirportShuttleIcon,
  CheckCircleIcon,
  ElevatorIcon,
  FitnessCenterIcon,
  FreeBreakfastIcon,
  LocalParkingIcon,
  PoolIcon,
  RestaurantIcon,
  RoomServiceIcon,
  SmokeFreeIcon,
  SpaIcon,
  SupportAgentIcon,
  WifiIcon,
  type SvgIconComponent,
} from "@/components/ui/mui-icons";
import { AMENITIES, AMENITY_LABELS } from "@/modules/partner-applications/config";

/** One distinct glyph per facility — see modules/partner-applications/config.ts for the canonical key list. */
const AMENITY_ICON: Record<string, SvgIconComponent> = {
  wifi: WifiIcon,
  parking: LocalParkingIcon,
  pool: PoolIcon,
  breakfast_included: FreeBreakfastIcon,
  airport_shuttle: AirportShuttleIcon,
  air_conditioning: AcUnitIcon,
  restaurant: RestaurantIcon,
  gym: FitnessCenterIcon,
  spa: SpaIcon,
  elevator: ElevatorIcon,
  front_desk_24h: SupportAgentIcon,
  non_smoking_rooms: SmokeFreeIcon,
  // Older seed data / a since-renamed checkbox — kept so hotels saved before
  // the amenities list was standardized still get a real icon and label
  // rather than the generic fallback.
  front_desk_24_7: SupportAgentIcon,
  room_service: RoomServiceIcon,
};

const LEGACY_LABEL: Record<string, string> = {
  front_desk_24_7: "24-hour front desk",
  room_service: "Room service",
};

/** Falls back to a plain check for any value outside the known list. */
export function amenityIcon(amenity: string): SvgIconComponent {
  return AMENITY_ICON[amenity] ?? CheckCircleIcon;
}

/** Prefers the canonical label, then the legacy alias, then a title-cased fallback of the raw key. */
export function amenityDisplayLabel(amenity: string): string {
  return AMENITY_LABELS[amenity] ?? LEGACY_LABEL[amenity] ?? amenity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Canonical display order, so a hotel's facilities read the same way on every page regardless of toggle order. */
export function sortAmenities(amenities: string[]): string[] {
  const rank = new Map(AMENITIES.map((a, i) => [a as string, i]));
  return [...amenities].sort((a, b) => (rank.get(a) ?? AMENITIES.length) - (rank.get(b) ?? AMENITIES.length));
}
