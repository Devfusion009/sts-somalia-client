"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/mui-icons";
/**
 * Horizontal scroll-snap rail with the circular prev/next controls the
 * reference design uses. Native scrolling does the heavy lifting (so it stays
 * touch/trackpad/keyboard friendly and needs no carousel library); the buttons
 * just nudge scrollLeft by one card width and disable at the ends.
 */
export function CarouselRail({
  children,
  className,
  itemClassName,
  ariaLabel,
  controlsClassName,
}: {
  children: ReactNode;
  className?: string;
  /** Applied to the wrapper around each child — set widths here. */
  itemClassName?: string;
  ariaLabel: string;
  controlsClassName?: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    sync();
    const el = railRef.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.offsetWidth + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={railRef}
        onScroll={sync}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className="scrollbar-none flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth rounded-2xl pb-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:scroll-auto"
      >
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div key={i} className={cn("shrink-0 snap-start", itemClassName)}>
                {child}
              </div>
            ))
          : children}
      </div>

      <div className={cn("pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between sm:flex", controlsClassName)}>
        <RailButton
          direction="prev"
          disabled={atStart}
          onClick={() => scrollByCard(-1)}
          label={`Scroll ${ariaLabel} back`}
          className="-translate-x-1/2"
        />
        <RailButton
          direction="next"
          disabled={atEnd}
          onClick={() => scrollByCard(1)}
          label={`Scroll ${ariaLabel} forward`}
          className="translate-x-1/2"
        />
      </div>
    </div>
  );
}

function RailButton({
  direction,
  disabled,
  onClick,
  label,
  className,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "pointer-events-auto grid size-10 place-items-center rounded-full border border-border bg-card text-foreground shadow-lg transition-all duration-200",
        "hover:border-primary/40 hover:bg-primary hover:text-primary-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-0",
        className
      )}
    >
      <Icon sx={{ fontSize: 22 }} aria-hidden />
    </button>
  );
}
