"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { usePrefersReducedMotion } from "@/components/ui/aceternity/motion-primitives";
import { EventsArt, FlightArt, HotelArt, UmrahArt, VisaArt } from "./nav-loader-art";

type SectionKey = "flights" | "hotels" | "visa" | "umrah" | "events";

const SECTIONS: Record<SectionKey, { name: string; Art: ComponentType }> = {
  flights: { name: "Flights", Art: FlightArt },
  hotels: { name: "Hotels", Art: HotelArt },
  visa: { name: "Visa", Art: VisaArt },
  umrah: { name: "Umrah", Art: UmrahArt },
  events: { name: "Events & Halls", Art: EventsArt },
};

/** The header section a pathname belongs to, or null for any other page. */
function sectionFor(pathname: string): SectionKey | null {
  const first = pathname.split("/")[1];
  return first && first in SECTIONS ? (first as SectionKey) : null;
}

/** The loader never covers the page for longer than this, whatever the router does. */
const FAILSAFE_MS = 12_000;
/** Shortest time the popup stays up, so a fast route change does not flash it. */
const MIN_VISIBLE_MS = 650;

type Pending = { section: SectionKey; fromKey: string; minDone: boolean; expired: boolean };

/**
 * Branded popup shown while a header link (anything inside `[data-nav-loader]`)
 * takes the visitor to Flights, Hotels, Visa, Umrah or Events & Halls.
 *
 * One delegated click listener starts it, so the header links need only the
 * attribute. The popup ends when the URL changes (and the minimum time has
 * passed); the failsafe ends it if the navigation never lands.
 */
export function NavLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduced = usePrefersReducedMotion();
  const [pending, setPending] = useState<Pending | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const key = `${pathname}?${searchParams.toString()}`;
  const arrived = pending !== null && key !== pending.fromKey;
  const visible = pending !== null && !pending.expired && !(arrived && pending.minDone);

  useEffect(() => {
    const clearTimers = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !anchor.closest("[data-nav-loader]")) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const section = sectionFor(url.pathname);
      if (!section) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      clearTimers();
      setPending({
        section,
        fromKey: `${window.location.pathname}?${window.location.search.replace(/^\?/, "")}`,
        minDone: false,
        expired: false,
      });
      timers.current.push(
        setTimeout(() => setPending((p) => (p ? { ...p, minDone: true } : p)), MIN_VISIBLE_MS),
        setTimeout(() => setPending((p) => (p ? { ...p, expired: true } : p)), FAILSAFE_MS)
      );
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimers();
    };
  }, []);

  return (
    <AnimatePresence onExitComplete={() => setPending(null)}>
      {visible && pending ? <Popup key="nav-loader" section={pending.section} reduced={reduced} /> : null}
    </AnimatePresence>
  );
}

function Popup({ section, reduced }: { section: SectionKey; reduced: boolean }) {
  const { name, Art } = SECTIONS[section];

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-[100] grid place-items-center px-5">
      <span className="sr-only">STS {name} is loading</span>

      <motion.div
        aria-hidden
        className="absolute inset-0 bg-sidebar/45 backdrop-blur-[6px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.12 : 0.35, ease: "easeOut" }}
      />

      <motion.div
        aria-hidden
        className="relative w-[min(20rem,100%)] overflow-hidden rounded-[2rem] bg-sidebar px-8 pt-9 pb-7 text-center text-white shadow-[0_40px_90px_-24px_rgb(0_0_0/0.65)]"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 18, filter: "blur(10px)" }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -10, filter: "blur(6px)" }}
        transition={reduced ? { duration: 0.12 } : { type: "spring", stiffness: 240, damping: 24, mass: 0.9 }}
      >
        <span className="nav-loader-ring pointer-events-none absolute inset-0 rounded-[inherit]" />
        <span className="pointer-events-none absolute -top-28 left-1/2 size-72 -translate-x-1/2 rounded-full bg-sidebar-primary/20 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-24 -left-10 size-48 rounded-full bg-brand-accent/10 blur-3xl" />

        <div className="relative mx-auto grid size-36 place-items-center">
          <span className="nav-fx-pulse absolute inset-4 rounded-full bg-sidebar-primary/15" />
          <span className="nav-fx-orbit absolute inset-0">
            <span className="absolute inset-0 rounded-full border border-dashed border-white/20" />
            <span className="absolute top-0 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-accent shadow-[0_0_14px_var(--brand-accent)]" />
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              className="relative"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8, rotate: -6 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
              transition={{ duration: reduced ? 0.1 : 0.28, ease: "easeOut" }}
            >
              <Art />
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="relative mt-6 font-heading text-lg font-semibold tracking-tight">
          STS <span className="text-sidebar-primary">{name}</span> is loading
          <span className="ml-0.5 inline-flex gap-[3px] align-baseline" aria-hidden>
            <span className="nav-fx-dot size-[3px] rounded-full bg-white/80" />
            <span className="nav-fx-dot size-[3px] rounded-full bg-white/80" style={{ animationDelay: ".16s" }} />
            <span className="nav-fx-dot size-[3px] rounded-full bg-white/80" style={{ animationDelay: ".32s" }} />
          </span>
        </p>

        <div className="relative mt-5 h-1 overflow-hidden rounded-full bg-white/10">
          <span className="animate-progress-sweep absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-sidebar-primary to-brand-accent" />
        </div>
      </motion.div>
    </div>
  );
}
