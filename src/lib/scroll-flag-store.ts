"use client";

import { useSyncExternalStore } from "react";

/**
 * A cached "is the page scrolled past X" store for useSyncExternalStore.
 *
 * Why this exists rather than an inline `() => window.scrollY > N` snapshot:
 *
 * 1. `getSnapshot` MUST be cached. React re-reads it at commit and compares
 *    with the render-time value; if they differ it force-re-renders. Reading
 *    `window.scrollY` live makes that comparison racy.
 * 2. Anything that resizes on scroll feeds back into scroll position. Collapsing
 *    a sticky header removes its height from the document flow, Chrome's scroll
 *    anchoring compensates by adjusting `scrollY`, and that can push the value
 *    back across a single threshold — render condensed, commit expanded,
 *    condensed, … until React throws "Maximum update depth exceeded".
 *
 * Both are handled here: the flag is computed in the scroll listener and cached,
 * so render and commit always agree; and separate enter/leave thresholds
 * (hysteresis) mean a few pixels of layout compensation can never flip it back.
 */
export function createScrollFlagStore(enterAt: number, leaveAt: number) {
  if (leaveAt >= enterAt) {
    throw new Error("leaveAt must be below enterAt so the flag has hysteresis");
  }

  let flag = false;
  const listeners = new Set<() => void>();

  const recompute = () => {
    const y = window.scrollY;
    // Once on, it takes scrolling back above `leaveAt` to turn off again.
    const next = flag ? y > leaveAt : y > enterAt;
    if (next === flag) return;
    flag = next;
    for (const listener of listeners) listener();
  };

  const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    if (listeners.size === 1) {
      window.addEventListener("scroll", recompute, { passive: true });
      // Catch a page that loaded already scrolled (reload, back-nav, #anchor).
      recompute();
    }
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) window.removeEventListener("scroll", recompute);
    };
  };

  const getSnapshot = () => flag;
  const getServerSnapshot = () => false;

  return () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
