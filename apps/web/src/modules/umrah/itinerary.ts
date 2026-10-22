/**
 * Dated itinerary for one Umrah booking, derived on every render from the
 * departure, its flights, the package hotels and the day plan — never stored,
 * so it cannot drift from the source rows the way a copied snapshot does.
 *
 * Pure and framework-free: the account, agent and admin pages and the
 * itinerary PDF all call it. Dates are 'YYYY-MM-DD' calendar days handled in
 * UTC arithmetic only, so no timezone can shift a day.
 */

export type ItineraryFlight = {
  airline: string | null;
  flightNumber: string | null;
  departsAt: string | null;
  arrivesAt: string | null;
};

export type ItineraryHotel = { city: string; name: string; nights: number | null; sort_order?: number | null };
export type ItineraryDay = { day_number: number; title: string; description: string | null };
export type ItinerarySegment = {
  kind: string;
  title: string;
  provider: string | null;
  reference: string | null;
  starts_at: string | null;
  ends_at: string | null;
  city: string | null;
};

export type HotelStay = { city: string; name: string; checkIn: string; checkOut: string; nights: number };

export type ItineraryEntry = {
  date: string;
  dayNumber: number;
  title: string | null;
  description: string | null;
  stay: HotelStay | null;
  /** One line per flight or segment that starts on this day. */
  travel: string[];
};

export type DatedItinerary = {
  entries: ItineraryEntry[];
  stays: HotelStay[];
  /** Soft consistency checks for staff: nights vs trip length, day plan vs trip length. */
  warnings: ("nights_mismatch" | "days_mismatch")[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string) {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

function daysBetween(from: string, to: string) {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Flight and segment times are wall-clock times tagged UTC, so the UTC date is the local date. */
function utcDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

function flightLine(label: string, flight: ItineraryFlight) {
  const name = [flight.airline, flight.flightNumber].filter(Boolean).join(" ");
  const times = [
    flight.departsAt ? `departs ${TIME.format(new Date(flight.departsAt))}` : null,
    flight.arrivesAt ? `arrives ${TIME.format(new Date(flight.arrivesAt))}` : null,
  ].filter(Boolean);
  return [label, name || null, times.join(", ") || null].filter(Boolean).join(" · ");
}

function segmentLine(segment: ItinerarySegment) {
  const time = segment.starts_at ? TIME.format(new Date(segment.starts_at)) : null;
  return [segment.title, segment.provider, segment.reference, time].filter(Boolean).join(" · ");
}

export function buildDatedItinerary(input: {
  departureDate: string;
  returnDate?: string | null;
  durationDays?: number | null;
  outbound?: ItineraryFlight | null;
  inbound?: ItineraryFlight | null;
  hotels?: ItineraryHotel[];
  days?: ItineraryDay[];
  segments?: ItinerarySegment[];
}): DatedItinerary {
  const segments = input.segments ?? [];
  const hotelSegments = segments.filter((s) => s.kind === "hotel" && s.starts_at);
  const travelSegments = segments.filter((s) => s.kind !== "hotel" && s.starts_at);
  const flightSegments = travelSegments.filter((s) => s.kind === "flight");

  // Hotel stays: booking-level hotel segments win over the package hotels.
  let stays: HotelStay[];
  if (hotelSegments.length > 0) {
    stays = hotelSegments
      .map((s) => {
        const checkIn = utcDate(s.starts_at!);
        const checkOut = s.ends_at ? utcDate(s.ends_at) : addDays(checkIn, 1);
        return { city: s.city ?? "other", name: s.title, checkIn, checkOut, nights: Math.max(daysBetween(checkIn, checkOut), 0) };
      })
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  } else {
    let offset = 0;
    stays = [...(input.hotels ?? [])]
      .filter((h) => (h.nights ?? 0) > 0)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((h) => {
        const checkIn = addDays(input.departureDate, offset);
        offset += h.nights ?? 0;
        return { city: h.city, name: h.name, checkIn, checkOut: addDays(checkIn, h.nights ?? 0), nights: h.nights ?? 0 };
      });
  }

  const nights = stays.reduce((sum, s) => sum + s.nights, 0);
  const plan = [...(input.days ?? [])].sort((a, b) => a.day_number - b.day_number);
  const tripDays = Math.max(
    input.returnDate ? daysBetween(input.departureDate, input.returnDate) + 1 : nights + 1,
    plan.length > 0 ? plan[plan.length - 1].day_number : 0,
    1
  );
  const lastDate = input.returnDate ?? addDays(input.departureDate, tripDays - 1);

  const travelByDate = new Map<string, string[]>();
  const pushTravel = (date: string, line: string) => {
    travelByDate.set(date, [...(travelByDate.get(date) ?? []), line]);
  };
  if (flightSegments.length === 0) {
    if (input.outbound && (input.outbound.airline || input.outbound.flightNumber || input.outbound.departsAt)) {
      pushTravel(input.outbound.departsAt ? utcDate(input.outbound.departsAt) : input.departureDate, flightLine("Outbound", input.outbound));
    }
    if (input.inbound && (input.inbound.airline || input.inbound.flightNumber || input.inbound.departsAt)) {
      pushTravel(input.inbound.departsAt ? utcDate(input.inbound.departsAt) : lastDate, flightLine("Return", input.inbound));
    }
  }
  for (const segment of travelSegments) {
    pushTravel(utcDate(segment.starts_at!), segmentLine(segment));
  }

  const planByDay = new Map(plan.map((d) => [d.day_number, d]));
  const entries: ItineraryEntry[] = [];
  for (let i = 0; i < tripDays; i++) {
    const date = addDays(input.departureDate, i);
    const day = planByDay.get(i + 1) ?? null;
    entries.push({
      date,
      dayNumber: i + 1,
      title: day?.title ?? null,
      description: day?.description ?? null,
      stay: stays.find((s) => s.checkIn <= date && date < s.checkOut) ?? null,
      travel: travelByDate.get(date) ?? [],
    });
  }
  // Travel outside the trip window (an early positioning flight) still shows.
  for (const [date, lines] of travelByDate) {
    if (date < input.departureDate || date > addDays(input.departureDate, tripDays - 1)) {
      entries.push({ date, dayNumber: daysBetween(input.departureDate, date) + 1, title: null, description: null, stay: null, travel: lines });
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));

  const warnings: DatedItinerary["warnings"] = [];
  if (stays.length > 0 && input.returnDate && nights + 1 !== daysBetween(input.departureDate, input.returnDate) + 1) {
    warnings.push("nights_mismatch");
  }
  if (plan.length > 0 && input.durationDays && plan[plan.length - 1].day_number !== input.durationDays) {
    warnings.push("days_mismatch");
  }

  return { entries, stays, warnings };
}

export const CITY_LABEL: Record<string, string> = {
  makkah: "Makkah",
  madinah: "Madinah",
  jeddah: "Jeddah",
  other: "Other",
};
