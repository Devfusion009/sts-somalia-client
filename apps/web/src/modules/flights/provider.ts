import "server-only";
import { resolveDuffelApiKey } from "@/lib/provider-runtime/duffel";

/**
 * Flight search against Duffel's offer-request API. The API key comes from
 * the admin-managed platform_api_integrations table when Duffel is active
 * there, falling back to the legacy DUFFEL_API_KEY env var — so existing
 * env-only deployments keep working unchanged. With neither configured, the
 * module degrades to the manual quote-request flow. No SDK — plain fetch,
 * mapped to a small offer shape the UI owns.
 */

export type FlightSearchParams = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  cabinClass: "economy" | "premium_economy" | "business" | "first";
};

export type FarePenalty = { amount: number; currency: string } | null;

export type FlightOffer = {
  id: string;
  airline: string;
  origin: string;
  destination: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number | null;
  stops: number;
  cabinClass: string;
  totalAmount: number;
  currency: string;
  /** null = Duffel didn't return conditions for this fare (unknown, not "no"). */
  refundable: boolean | null;
  refundPenalty: FarePenalty;
  changeable: boolean | null;
  changePenalty: FarePenalty;
  /** Checked bags for the first passenger's first segment — a summary, not a per-passenger/per-segment breakdown. */
  checkedBagsIncluded: number | null;
};

export type FlightSearchResult = {
  live: boolean;
  offers: FlightOffer[];
  /** Set when a live search was attempted but failed. */
  providerError?: string;
};

type DuffelBaggage = { type?: string; quantity?: number };

type DuffelPassenger = { baggages?: DuffelBaggage[] };

type DuffelSegment = {
  origin?: { iata_code?: string };
  destination?: { iata_code?: string };
  departing_at?: string;
  arriving_at?: string;
  passengers?: DuffelPassenger[];
};

type DuffelConditionEntry = {
  allowed?: boolean;
  penalty_amount?: string;
  penalty_currency?: string;
};

type DuffelOffer = {
  id: string;
  total_amount?: string;
  total_currency?: string;
  owner?: { name?: string };
  slices?: Array<{ duration?: string; segments?: DuffelSegment[] }>;
  conditions?: {
    refund_before_departure?: DuffelConditionEntry | null;
    change_before_departure?: DuffelConditionEntry | null;
  };
};

function mapPenalty(entry: DuffelConditionEntry | null | undefined): FarePenalty {
  if (!entry?.penalty_amount) return null;
  const amount = Number(entry.penalty_amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, currency: entry.penalty_currency ?? "USD" };
}

/** ISO 8601 duration (PT4H30M) → minutes. */
function parseDuration(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(duration);
  if (!match) return null;
  const [, days, hours, minutes] = match;
  return (Number(days ?? 0) * 24 + Number(hours ?? 0)) * 60 + Number(minutes ?? 0);
}

export async function searchLiveFlights(params: FlightSearchParams): Promise<FlightSearchResult> {
  const apiKey = await resolveDuffelApiKey();
  if (!apiKey) return { live: false, offers: [] };

  const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
    { origin: params.origin, destination: params.destination, departure_date: params.departDate },
  ];
  if (params.returnDate) {
    slices.push({
      origin: params.destination,
      destination: params.origin,
      departure_date: params.returnDate,
    });
  }

  try {
    const res = await fetch("https://api.duffel.com/air/offer_requests?return_offers=true", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          slices,
          passengers: Array.from({ length: params.adults }, () => ({ type: "adult" })),
          cabin_class: params.cabinClass,
        },
      }),
      // Live fares are point-in-time; never cache.
      cache: "no-store",
    });

    if (!res.ok) {
      return { live: true, offers: [], providerError: `Fare search failed (${res.status}).` };
    }

    const payload = (await res.json()) as { data?: { offers?: DuffelOffer[] } };
    const offers = (payload.data?.offers ?? []).flatMap((offer): FlightOffer[] => {
      const slice = offer.slices?.[0];
      const segments = slice?.segments ?? [];
      const first = segments[0];
      const last = segments[segments.length - 1];
      if (!first?.departing_at || !last?.arriving_at) return [];

      const refund = offer.conditions?.refund_before_departure;
      const change = offer.conditions?.change_before_departure;
      const checkedBags = first.passengers?.[0]?.baggages
        ?.filter((b) => b.type === "checked")
        .reduce((sum, b) => sum + (b.quantity ?? 0), 0);

      return [
        {
          id: offer.id,
          airline: offer.owner?.name ?? "Airline",
          origin: first.origin?.iata_code ?? params.origin,
          destination: last.destination?.iata_code ?? params.destination,
          departAt: first.departing_at,
          arriveAt: last.arriving_at,
          durationMinutes: parseDuration(slice?.duration),
          stops: Math.max(segments.length - 1, 0),
          cabinClass: params.cabinClass,
          totalAmount: Number(offer.total_amount ?? 0),
          currency: offer.total_currency ?? "USD",
          refundable: refund ? Boolean(refund.allowed) : null,
          refundPenalty: mapPenalty(refund),
          changeable: change ? Boolean(change.allowed) : null,
          changePenalty: mapPenalty(change),
          checkedBagsIncluded: checkedBags ?? null,
        },
      ];
    });

    offers.sort((a, b) => a.totalAmount - b.totalAmount);
    return { live: true, offers: offers.slice(0, 20) };
  } catch {
    return { live: true, offers: [], providerError: "The fare provider did not respond." };
  }
}
