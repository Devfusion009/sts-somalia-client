import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { addDays, buildDatedItinerary, type DatedItinerary, type ItinerarySegment } from "@/modules/umrah/itinerary";

type Client = SupabaseClient<Database>;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export type BookingTravel = {
  itinerary: DatedItinerary | null;
  hotels: {
    city: string;
    name: string;
    star_rating: number | null;
    distance_to_haram_m: number | null;
    room_type: string | null;
    checkIn: string | null;
    checkOut: string | null;
  }[];
  segments: (ItinerarySegment & { id: string; notes: string | null })[];
  contact: { name: string | null; phone: string | null; email: string | null; whatsapp: string | null } | null;
};

/**
 * Everything a booking's travel cards and the itinerary PDF need, read under
 * the caller's own RLS (customer, agency member or admin). Booked travellers
 * keep read access to an unpublished package (20261019000003).
 */
export async function getBookingTravel(supabase: Client, bookingId: string): Promise<BookingTravel | null> {
  const { data: booking } = await supabase
    .from("umrah_bookings")
    .select(
      `id, booking_kind, package_id, custom_request_id,
       package:package_id(duration_days, contact_person_name, contact_person_phone, contact_person_email, contact_whatsapp),
       departure:departure_id(departure_date, return_date, outbound_airline, outbound_flight_number, outbound_departs_at, outbound_arrives_at,
         return_airline, return_flight_number, return_departs_at, return_arrives_at),
       custom_request:custom_request_id(departure_date, nights_makkah, nights_madinah)`
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return null;

  const pkg = one(booking.package);
  const departure = one(booking.departure);
  const request = one(booking.custom_request);

  const [hotelRows, dayRows, segmentRows, requestHotelRows] = await Promise.all([
    booking.package_id
      ? supabase
          .from("umrah_package_hotels")
          .select("city, name, star_rating, distance_to_haram_m, nights, room_type, sort_order")
          .eq("package_id", booking.package_id)
          .order("sort_order")
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    booking.package_id
      ? supabase
          .from("umrah_itinerary_days")
          .select("day_number, title, description")
          .eq("package_id", booking.package_id)
          .order("day_number")
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    supabase
      .from("umrah_booking_segments")
      .select("id, kind, title, provider, reference, starts_at, ends_at, city, notes")
      .eq("booking_id", bookingId)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("sort_order")
      .then(({ data }) => data ?? []),
    booking.custom_request_id
      ? supabase
          .from("umrah_custom_request_services")
          .select("category, name")
          .eq("request_id", booking.custom_request_id)
          .in("category", ["hotel_makkah", "hotel_madinah"])
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
  ]);

  const departureDate = departure?.departure_date ?? request?.departure_date ?? null;

  // A private trip's hotels are the hotel services chosen in the builder,
  // Makkah first, for the nights set on the request.
  const hotels =
    booking.booking_kind === "private" && request
      ? [
          ...requestHotelRows
            .filter((h) => h.category === "hotel_makkah" && request.nights_makkah > 0)
            .map((h) => ({ city: "makkah", name: h.name, nights: request.nights_makkah, sort_order: 0 })),
          ...requestHotelRows
            .filter((h) => h.category === "hotel_madinah" && request.nights_madinah > 0)
            .map((h) => ({ city: "madinah", name: h.name, nights: request.nights_madinah, sort_order: 1 })),
        ]
      : hotelRows;

  const itinerary = departureDate
    ? buildDatedItinerary({
        departureDate,
        returnDate:
          departure?.return_date ??
          (request ? addDays(request.departure_date!, request.nights_makkah + request.nights_madinah) : null),
        durationDays: pkg?.duration_days ?? null,
        outbound: departure
          ? {
              airline: departure.outbound_airline,
              flightNumber: departure.outbound_flight_number,
              departsAt: departure.outbound_departs_at,
              arrivesAt: departure.outbound_arrives_at,
            }
          : null,
        inbound: departure
          ? {
              airline: departure.return_airline,
              flightNumber: departure.return_flight_number,
              departsAt: departure.return_departs_at,
              arrivesAt: departure.return_arrives_at,
            }
          : null,
        hotels,
        days: dayRows,
        segments: segmentRows,
      })
    : null;

  const stayFor = (name: string, city: string) =>
    itinerary?.stays.find((s) => s.name === name && s.city === city) ?? null;

  return {
    itinerary,
    hotels: hotels.map((h) => {
      const row = h as { star_rating?: number | null; distance_to_haram_m?: number | null; room_type?: string | null };
      const stay = stayFor(h.name, h.city);
      return {
        city: h.city,
        name: h.name,
        star_rating: row.star_rating ?? null,
        distance_to_haram_m: row.distance_to_haram_m ?? null,
        room_type: row.room_type ?? null,
        checkIn: stay?.checkIn ?? null,
        checkOut: stay?.checkOut ?? null,
      };
    }),
    segments: segmentRows,
    contact: pkg
      ? {
          name: pkg.contact_person_name,
          phone: pkg.contact_person_phone,
          email: pkg.contact_person_email,
          whatsapp: pkg.contact_whatsapp,
        }
      : null,
  };
}
