"use client";

import { InfiniteMovingRow } from "@/components/ui/aceternity/motion-primitives";

import { VerifiedIcon } from "@/components/ui/mui-icons";
const USPS = [
  "Licensed Somali travel agency",
  "Safe, seamless travel for every age group",
  "Fully customisable Umrah & holiday packages",
  "Local payment methods — EVC Plus, bank, card",
  "24/7 support from a Mogadishu-based team",
  "Confirmed rates, no hidden fees",
];

/** Dark scrolling USP band directly under the hero, as in the reference layout. */
export function UspStrip() {
  return (
    <div className="border-y border-white/10 bg-sidebar py-3 text-sidebar-foreground">
      <InfiniteMovingRow speed={48}>
        {USPS.map((usp) => (
          <span key={usp} className="flex shrink-0 items-center gap-2 px-6 text-sm font-semibold whitespace-nowrap">
            <VerifiedIcon sx={{ fontSize: 18 }} className="text-brand-accent" />
            {usp}
          </span>
        ))}
      </InfiniteMovingRow>
    </div>
  );
}
