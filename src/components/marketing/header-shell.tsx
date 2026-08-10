"use client";

import { createScrollFlagStore } from "@/lib/scroll-flag-store";

/**
 * Condense past 160px, expand again only below 40px.
 *
 * THE GAP MUST EXCEED THE LAYOUT SHIFT THE TOGGLE CAUSES. Condensing removes
 * ~53px of header from the document flow and the browser's scroll anchoring
 * compensates by moving scrollY by that same amount — measured live: a
 * condense triggered at y=84 left the page sitting at y=47.
 *
 * The first version used 80/40. A 40px gap is *narrower* than that 53px shift,
 * so a condense could land below the expand threshold, which expanded, which
 * pushed scrollY back up, which condensed… visible as the header vibrating
 * while scrolling. 160/40 leaves ~67px of margin on both edges, so no single
 * transition can ever cross the opposite threshold.
 */
export const useHeaderCondensed = createScrollFlagStore(160, 40);

/**
 * Sticky wrapper that publishes the condensed state to every descendant as a
 * `data-condensed` attribute. Children opt in with
 * `group-data-[condensed]/header:*` variants, which keeps the shrink logic as
 * pure CSS transitions — no per-element JS, and it stays inside a Server
 * Component tree (only this wrapper is a client component).
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const condensed = useHeaderCondensed();

  return (
    <div
      data-condensed={condensed ? "" : undefined}
      className="group/header sticky top-0 z-40 w-full"
    >
      {children}
    </div>
  );
}
