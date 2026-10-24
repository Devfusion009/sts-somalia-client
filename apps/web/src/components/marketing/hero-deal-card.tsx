"use client";

import {
  FlightTakeoffIcon,
  MosqueIcon,
  BedIcon,
  WorkspacePremiumIcon,
  PaymentsIcon,
  VerifiedIcon,
  type SvgIconComponent,
} from "@/components/ui/mui-icons";
import { cn } from "@/lib/utils";

/**
 * Glass "deal card" that fills the hero's right-hand space — a boarding-pass
 * style advert for whichever slide is showing.
 *
 * Purely presentational and non-interactive: the slide already has its own CTA,
 * and a second link to the same destination would just add duplicate stops for
 * keyboard and screen-reader users. The route detail here (IATA codes, cabin,
 * nights) is genuinely extra information, so it stays in the accessibility tree
 * rather than being hidden.
 *
 * Animation is CSS only (`tile-float`). A JS-gated entrance would risk the
 * whole panel sitting at opacity 0 if the frame loop stalls.
 */

export type HeroDeal = {
  kind: "flight" | "umrah" | "stay";
  tag: string;
  /** Left/right endpoints — IATA codes for flights, place names otherwise. */
  fromCode: string;
  fromLabel: string;
  toCode: string;
  toLabel: string;
  meta: Array<{ label: string; value: string }>;
  price: string;
  priceSuffix: string;
};

const KIND_ICON: Record<HeroDeal["kind"], SvgIconComponent> = {
  flight: FlightTakeoffIcon,
  umrah: MosqueIcon,
  stay: BedIcon,
};

const KIND_LABEL: Record<HeroDeal["kind"], string> = {
  flight: "Flight deal",
  umrah: "Umrah package",
  stay: "Stay deal",
};

const TRUST_CHIPS: Array<{ icon: SvgIconComponent; label: string }> = [
  { icon: WorkspacePremiumIcon, label: "IATA-experienced desk" },
  { icon: PaymentsIcon, label: "EVC Plus · Bank · Card" },
  { icon: VerifiedIcon, label: "Confirmed before you pay" },
];

export function HeroDealCard({
  deal,
  className,
  "aria-hidden": ariaHidden,
}: {
  deal: HeroDeal;
  className?: string;
  "aria-hidden"?: boolean;
}) {
  const Icon = KIND_ICON[deal.kind];

  return (
    <div aria-hidden={ariaHidden} className={cn("w-[340px] xl:w-[380px]", className)}>
      {/* Ticket */}
      <div className="tile-float relative overflow-hidden rounded-2xl border border-white/25 bg-white/10 shadow-2xl shadow-black/50 backdrop-blur-xl">
        {/* Warm sheen so the glass reads as a lit surface, not a grey box */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-brand-accent/15"
          aria-hidden
        />

        <div className="relative p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs font-bold text-white/80">
              {/* Solid tile, not a translucent one — a white glyph on bg-white/15
                  over a photo had almost no contrast at 16px. */}
              <span className="grid size-9 place-items-center rounded-lg bg-white text-sidebar shadow-md">
                <Icon sx={{ fontSize: 22 }} />
              </span>
              {KIND_LABEL[deal.kind]}
            </span>
            <span className="inline-flex items-center rounded-full bg-brand-accent px-2.5 py-1 text-[11px] font-bold text-brand-accent-foreground">
              {deal.tag}
            </span>
          </div>

          {/* Route */}
          <div className="mt-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading text-3xl leading-none font-extrabold text-white">{deal.fromCode}</p>
              <p className="mt-1 truncate text-xs text-white/60">{deal.fromLabel}</p>
            </div>

            <div className="flex flex-1 flex-col items-center pb-1.5">
              {/* The route glyph is the card's focal point, so it gets a solid
                  accent disc rather than a bare 15px icon lost against the
                  dashed line and the photo behind it. */}
              <span className="flex w-full items-center gap-2">
                <span className="h-px flex-1 border-t-2 border-dashed border-white/50" />
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-accent text-white shadow-lg ring-2 ring-white/25">
                  <Icon sx={{ fontSize: 20 }} />
                </span>
                <span className="h-px flex-1 border-t-2 border-dashed border-white/50" />
              </span>
            </div>

            <div className="min-w-0 text-right">
              <p className="font-heading text-3xl leading-none font-extrabold text-white">{deal.toCode}</p>
              <p className="mt-1 truncate text-xs text-white/60">{deal.toLabel}</p>
            </div>
          </div>
        </div>

        {/* Perforation — the notches are what sell the ticket metaphor */}
        <div className="relative">
          <span className="absolute top-1/2 -left-2.5 size-5 -translate-y-1/2 rounded-full bg-sidebar" aria-hidden />
          <span className="absolute top-1/2 -right-2.5 size-5 -translate-y-1/2 rounded-full bg-sidebar" aria-hidden />
          <div className="mx-5 border-t border-dashed border-white/30" />
        </div>

        <div className="relative flex items-end justify-between gap-3 p-5">
          <dl className="flex gap-5">
            {deal.meta.map((item) => (
              <div key={item.label}>
                <dt className="text-xs font-semibold text-white/50">{item.label}</dt>
                <dd className="mt-0.5 text-sm font-bold text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="text-right">
            <p className="text-xs font-semibold text-white/50">From</p>
            <p className="font-heading text-2xl leading-none font-extrabold text-brand-accent">{deal.price}</p>
            <p className="mt-0.5 text-[11px] text-white/60">{deal.priceSuffix}</p>
          </div>
        </div>
      </div>

      {/* Trust chips beneath the ticket */}
      <ul className="mt-4 flex flex-col items-start gap-2">
        {TRUST_CHIPS.map((chip) => (
          <li
            key={chip.label}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur-md"
          >
            <chip.icon sx={{ fontSize: 15 }} className="shrink-0 text-brand-accent" />
            {chip.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
