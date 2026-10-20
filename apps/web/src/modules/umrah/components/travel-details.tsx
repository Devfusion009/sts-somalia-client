import { BedDouble, Plane } from "lucide-react";
import { CITY_LABEL, type DatedItinerary } from "@/modules/umrah/itinerary";
import type { BookingTravel } from "@/modules/umrah/itinerary-queries";

function formatDay(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatShort(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The dated day-by-day plan. Rows only; the page supplies the heading and frame. */
export function ItineraryList({ itinerary }: { itinerary: DatedItinerary }) {
  return (
    <ol className="divide-y divide-border">
      {itinerary.entries.map((entry) => (
        <li key={entry.date} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3">
          <div className="w-28 shrink-0">
            <p className="text-sm font-medium tabular-nums">{formatDay(entry.date)}</p>
            <p className="text-xs text-muted-foreground">Day {entry.dayNumber}</p>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {entry.title ? <p className="text-sm font-medium">{entry.title}</p> : null}
            {entry.description ? <p className="text-sm text-muted-foreground">{entry.description}</p> : null}
            {entry.travel.map((line) => (
              <p key={line} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Plane className="size-3.5 shrink-0" /> {line}
              </p>
            ))}
            {entry.stay ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BedDouble className="size-3.5 shrink-0" /> {entry.stay.name} · {CITY_LABEL[entry.stay.city] ?? entry.stay.city}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Hotels with their dates. Rows only. */
export function HotelStayList({ hotels }: { hotels: BookingTravel["hotels"] }) {
  return (
    <ul className="divide-y divide-border">
      {hotels.map((hotel) => (
        <li key={`${hotel.city}-${hotel.name}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{hotel.name}</p>
            <p className="text-xs text-muted-foreground">
              {[
                CITY_LABEL[hotel.city] ?? hotel.city,
                hotel.star_rating ? `${hotel.star_rating}-star` : null,
                hotel.distance_to_haram_m ? `${hotel.distance_to_haram_m} m to the Haram` : null,
                hotel.room_type,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {hotel.checkIn ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatShort(hotel.checkIn)} – {formatShort(hotel.checkOut)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Package contact person, joined on one line. */
export function contactLine(contact: BookingTravel["contact"]) {
  if (!contact) return null;
  const parts = [contact.name, contact.phone, contact.whatsapp && contact.whatsapp !== contact.phone ? `WhatsApp ${contact.whatsapp}` : null, contact.email].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
