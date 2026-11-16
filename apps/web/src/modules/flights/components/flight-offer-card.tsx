import type { ReactNode } from "react";
import { Luggage, Plane, ShieldCheck } from "lucide-react";
import type { FlightLeg, FlightOffer } from "@sts/shared-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Provider times are the airport's local wall clock. Read them as-is:
// converting through the server's timezone would shift every flight.
export function flightTime(iso: string) {
  return iso.slice(11, 16);
}

export function flightDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function flightDuration(minutes: number | null) {
  if (!minutes) return "";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function fare(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function stops(count: number) {
  return count === 0 ? "Non-stop" : `${count} stop${count > 1 ? "s" : ""}`;
}

function LegRow({ label, leg, from, to }: { label?: string; leg: FlightLeg; from: string; to: string }) {
  return (
    <div className="flex min-w-0 flex-1 basis-64 items-center gap-3 sm:gap-4">
      {label ? <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">{label}</span> : null}
      <div className="text-right">
        <p className="font-heading text-lg font-bold tabular-nums">{flightTime(leg.departAt)}</p>
        <p className="text-xs text-muted-foreground">
          {from} · {flightDate(leg.departAt)}
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center px-2">
        <p className="text-xs text-muted-foreground tabular-nums">{flightDuration(leg.durationMinutes)}</p>
        <div className="relative h-px w-full min-w-16 bg-border">
          <Plane className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 text-primary" aria-hidden />
        </div>
        <p className="text-xs text-muted-foreground">{stops(leg.stops)}</p>
      </div>
      <div>
        <p className="font-heading text-lg font-bold tabular-nums">{flightTime(leg.arriveAt)}</p>
        <p className="text-xs text-muted-foreground">
          {to} · {flightDate(leg.arriveAt)}
        </p>
      </div>
    </div>
  );
}

/** One fare: outbound (and return) legs, baggage and fare type, price and the action. */
export function FlightOfferCard({ offer, action }: { offer: FlightOffer; action?: ReactNode }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 p-4 sm:p-5">
        <div className="min-w-32">
          <p className="text-sm font-bold">{offer.airline}</p>
          <p className="text-xs text-muted-foreground">{offer.flightNumbers.join(" · ")}</p>
        </div>
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-3">
          <LegRow label={offer.returnLeg ? "Depart" : undefined} leg={offer} from={offer.origin} to={offer.destination} />
          {offer.returnLeg ? <LegRow label="Return" leg={offer.returnLeg} from={offer.destination} to={offer.origin} /> : null}
        </div>
        <div className="ml-auto flex flex-col items-end gap-2 text-right">
          <div>
            <p className="font-heading text-xl font-bold text-primary tabular-nums">{fare(offer.totalAmount, offer.currency)}</p>
            <p className="text-xs text-muted-foreground">total, all passengers</p>
          </div>
          {action}
        </div>
        <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-border pt-3">
          <Badge variant="outline" className="text-xs font-normal capitalize">
            {offer.cabinClass.replace("_", " ")}
          </Badge>
          {offer.checkedBagsIncluded !== null ? (
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <Luggage className="size-3" aria-hidden />
              {offer.checkedBagsIncluded === 0
                ? "Carry-on only"
                : `${offer.checkedBagsIncluded} checked bag${offer.checkedBagsIncluded > 1 ? "s" : ""}`}
            </Badge>
          ) : null}
          {offer.refundable !== null ? (
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <ShieldCheck className="size-3" aria-hidden />
              {offer.refundable ? "Refundable" : "Non-refundable"}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
