import { countryName } from "@/lib/countries";

/** "Street, City, Country" without repeating the city when the address is only the city. */
export function hotelLocation(hotel: { address_line?: string | null; city: string; country_code: string }) {
  const address = hotel.address_line?.trim();
  const parts = [
    address && address.toLowerCase() !== hotel.city.trim().toLowerCase() ? address : null,
    hotel.city,
    countryName(hotel.country_code) || hotel.country_code,
  ];
  return parts.filter(Boolean).join(", ");
}

/** "City, Country" for cards and list rows. */
export function hotelCityCountry(hotel: { city: string; country_code: string }) {
  return `${hotel.city}, ${countryName(hotel.country_code) || hotel.country_code}`;
}
