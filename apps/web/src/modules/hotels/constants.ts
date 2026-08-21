/**
 * Curated vocabularies for room-level fields. Unlike hotel_room_types (a
 * growing shared catalog table — see room-types.ts), bed types and room
 * amenities are small, stable, industry-standard lists that don't need a
 * database table: a fixed <Select>/checkbox set is the "professional"
 * version of what was a free-text input, without inventing a taxonomy.
 * Values are stored as-is in hotel_rooms.bed_type (text) and
 * hotel_rooms.amenities (jsonb string[]) — amenityLabel() in
 * modules/hotels/images.ts already title-cases these for display.
 */

export const ROOM_BED_TYPES = [
  "Single Bed",
  "Twin Beds",
  "Double Bed",
  "Queen Bed",
  "King Bed",
  "Twin/Double (Convertible)",
  "Bunk Bed",
  "Sofa Bed",
  "Multiple Beds",
] as const;

export const ROOM_AMENITIES = [
  { value: "balcony", label: "Balcony" },
  { value: "sea_view", label: "Sea view" },
  { value: "city_view", label: "City view" },
  { value: "garden_view", label: "Garden view" },
  { value: "air_conditioning", label: "Air conditioning" },
  { value: "private_bathroom", label: "Private bathroom" },
  { value: "free_wifi", label: "Free WiFi" },
  { value: "minibar", label: "Minibar" },
  { value: "safe_box", label: "Safe box" },
  { value: "flat_screen_tv", label: "Flat-screen TV" },
  { value: "work_desk", label: "Work desk" },
  { value: "bathtub", label: "Bathtub" },
  { value: "non_smoking", label: "Non-smoking" },
  { value: "connecting_rooms", label: "Connecting rooms" },
  { value: "wheelchair_accessible", label: "Wheelchair accessible" },
  { value: "kitchenette", label: "Kitchenette" },
  { value: "soundproofing", label: "Soundproofing" },
  { value: "breakfast_included", label: "Breakfast included" },
] as const;
