/** The dated itinerary builder lives in the shared contract (apps/api builds the same plan). */
export {
  buildDatedItinerary,
  addCalendarDays as addDays,
  UMRAH_CITY_LABEL as CITY_LABEL,
  type ItineraryFlight,
  type ItineraryHotel,
  type ItineraryDay,
  type ItinerarySegment,
  type HotelStay,
  type ItineraryEntry,
  type DatedItinerary,
} from "@sts/shared-types";
