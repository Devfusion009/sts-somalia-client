import { Luggage, PlaneLanding, PlaneTakeoff } from "lucide-react";
import { cn } from "@/lib/utils";

export type DepartureFlights = {
  outbound_airline: string | null;
  outbound_flight_number: string | null;
  outbound_departs_at: string | null;
  outbound_arrives_at: string | null;
  return_airline: string | null;
  return_flight_number: string | null;
  return_departs_at: string | null;
  return_arrives_at: string | null;
  baggage_note: string | null;
};

// Departure times are stored as the airport's local wall time tagged UTC, so
// they render in UTC to come back out exactly as entered.
const FLIGHT_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function formatFlightTime(value: string | null) {
  return value ? FLIGHT_TIME.format(new Date(value)) : null;
}

type Leg = {
  airline: string | null;
  flightNumber: string | null;
  departsAt: string | null;
  arrivesAt: string | null;
};

function hasLeg(leg: Leg) {
  return Boolean(leg.airline || leg.flightNumber || leg.departsAt || leg.arrivesAt);
}

export function hasFlightDetails(d: DepartureFlights) {
  return (
    hasLeg(outboundLeg(d)) || hasLeg(returnLeg(d)) || Boolean(d.baggage_note && d.baggage_note.trim())
  );
}

function outboundLeg(d: DepartureFlights): Leg {
  return {
    airline: d.outbound_airline,
    flightNumber: d.outbound_flight_number,
    departsAt: d.outbound_departs_at,
    arrivesAt: d.outbound_arrives_at,
  };
}

function returnLeg(d: DepartureFlights): Leg {
  return {
    airline: d.return_airline,
    flightNumber: d.return_flight_number,
    departsAt: d.return_departs_at,
    arrivesAt: d.return_arrives_at,
  };
}

function LegRow({ label, leg, icon: Icon }: { label: string; leg: Leg; icon: typeof PlaneTakeoff }) {
  const carrier = [leg.airline, leg.flightNumber].filter(Boolean).join(" ");
  const departs = formatFlightTime(leg.departsAt);
  const arrives = formatFlightTime(leg.arrivesAt);
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          {label}
          {carrier ? <span className="ml-1.5 font-normal text-muted-foreground">{carrier}</span> : null}
        </p>
        {departs || arrives ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {departs ? `Departs ${departs}` : null}
            {departs && arrives ? " · " : null}
            {arrives ? `Arrives ${arrives}` : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Renders only the flight fields that are set; nothing when none are. */
export function FlightDetails({ departure, className }: { departure: DepartureFlights; className?: string }) {
  if (!hasFlightDetails(departure)) return null;
  const outbound = outboundLeg(departure);
  const inbound = returnLeg(departure);
  const baggage = departure.baggage_note?.trim();
  return (
    <div className={cn("space-y-2.5", className)}>
      {hasLeg(outbound) ? <LegRow label="Outbound" leg={outbound} icon={PlaneTakeoff} /> : null}
      {hasLeg(inbound) ? <LegRow label="Return" leg={inbound} icon={PlaneLanding} /> : null}
      {baggage ? (
        <div className="flex items-start gap-2.5 text-sm">
          <Luggage className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{baggage}</span>
        </div>
      ) : null}
    </div>
  );
}
