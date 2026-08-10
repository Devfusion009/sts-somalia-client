"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Fade-up-on-first-intersection wrapper for landing bands. All hidden state
 * is behind `motion-safe:` so reduced-motion visitors (and anyone whose JS
 * fails) always see content at its final position. Never wrap the hero —
 * it's the LCP element and must paint immediately.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger offset in ms, applied via transition-delay. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No reduced-motion branch needed: the hidden styles are all behind
    // `motion-safe:`, so reduced-motion visitors see content immediately
    // regardless of `shown`.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10%" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:ease-out",
        !shown && "motion-safe:translate-y-4 motion-safe:opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}
