"use client";

import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useMotionTemplate,
  useInView,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------
 * Aceternity-UI-style building blocks, hand-written for this codebase.
 *
 * Aceternity ships as copy-paste source rather than an npm package, so these
 * live in the repo and depend only on `motion` + Tailwind — no extra runtime.
 * Every animation is wrapped so `prefers-reduced-motion` users land on the
 * final state instead of an invisible or jittering element.
 * ---------------------------------------------------------------------- */

/**
 * Subscribes to the OS motion preference. Written with useSyncExternalStore
 * rather than an effect + setState so React reads the live value during render
 * (no cascading re-render, and no first-frame flash of the animated state).
 * The server snapshot is `false` — SSR has no media queries, and "animate"
 * is the safe default because every animation here also renders its final
 * state when reduced motion is on.
 */
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

/* ---------------------------------- Fade / slide in on scroll ---------- */

type Direction = "up" | "down" | "left" | "right" | "none";

const OFFSETS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 28 },
  down: { x: 0, y: -28 },
  left: { x: 32, y: 0 },
  right: { x: -32, y: 0 },
  none: { x: 0, y: 0 },
};

export function FadeIn({
  children,
  className,
  direction = "up",
  delay = 0,
  duration = 0.6,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  direction?: Direction;
  delay?: number;
  duration?: number;
  once?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const offset = OFFSETS[direction];

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount: 0.2, margin: "0px 0px -8% 0px" }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Staggers direct children of a grid/list as it scrolls into view. */
export function StaggerGroup({
  children,
  className,
  stagger = 0.08,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  once?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView="visible"
      viewport={{ once, amount: 0.15 }}
      variants={{ visible: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------- Scroll-linked parallax ------------- */

/** Moves its content vertically as the section scrolls through the viewport. */
export function Parallax({
  children,
  className,
  distance = 60,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduced ? undefined : { y }} className="h-full w-full">
        {children}
      </motion.div>
    </div>
  );
}

/** Page-level scroll progress bar — sits under the sticky header. */
export function ScrollProgressBar({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 160, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      style={{ scaleX }}
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-primary via-brand-gold to-brand-accent",
        className
      )}
    />
  );
}

/* ---------------------------------- Spotlight card (pointer-follow) ---- */

/** Radial highlight that tracks the pointer across the card. */
export function SpotlightCard({
  children,
  className,
  spotlightColor = "0, 148, 124",
}: {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const background = useMotionTemplate`radial-gradient(340px circle at ${mouseX}px ${mouseY}px, rgba(${spotlightColor}, 0.16), transparent 72%)`;

  return (
    <div
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
      }}
      className={cn("group/spotlight relative overflow-hidden", className)}
    >
      <motion.div
        aria-hidden
        style={{ background }}
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100"
      />
      {children}
    </div>
  );
}

/* ---------------------------------- 3D tilt card ----------------------- */

/** Perspective tilt that follows the pointer — Aceternity's "3D card" effect. */
export function TiltCard({
  children,
  className,
  max = 8,
}: {
  children: ReactNode;
  className?: string;
  /** Maximum rotation in degrees. */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [transform, setTransform] = useState("");

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        if (reduced) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        setTransform(
          `perspective(1000px) rotateY(${px * max * 2}deg) rotateX(${-py * max * 2}deg) scale3d(1.02,1.02,1.02)`
        );
      }}
      onPointerLeave={() => setTransform("")}
      style={{ transform, transformStyle: "preserve-3d" }}
      className={cn("transition-transform duration-200 ease-out will-change-transform", className)}
    >
      {children}
    </div>
  );
}

/* ---------------------------------- Infinite moving cards -------------- */

/**
 * Seamless marquee rail — the track holds the children twice so a -50%
 * translate loops invisibly. Pauses on hover/focus; static under reduced motion.
 */
export function InfiniteMovingRow({
  children,
  className,
  speed = 40,
  direction = "left",
}: {
  children: ReactNode;
  className?: string;
  /** Seconds for one full loop. */
  speed?: number;
  direction?: "left" | "right";
}) {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return <div className={cn("flex flex-wrap justify-center gap-4", className)}>{children}</div>;
  }

  return (
    <div className={cn("group/marquee relative overflow-hidden", className)}>
      <motion.div
        className="flex w-max gap-4"
        animate={{ x: direction === "left" ? ["0%", "-50%"] : ["-50%", "0%"] }}
        transition={{ duration: speed, ease: "linear", repeat: Infinity }}
        whileHover={{ transition: { duration: 0 } }}
      >
        <div className="flex shrink-0 gap-4">{children}</div>
        <div className="flex shrink-0 gap-4" aria-hidden>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------------------------- Animated counter ------------------- */

/** Counts up to `value` the first time it scrolls into view. */
export function CountUp({
  value,
  suffix = "",
  prefix = "",
  duration = 1400,
  className,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    // Reduced motion runs the same loop with a zero budget, so the first frame
    // clamps straight to the final value. Keeping one code path means state is
    // only ever set from inside the rAF callback, never synchronously here.
    const budget = reduced ? 0 : duration;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = budget <= 0 ? 1 : Math.min((now - start) / budget, 1);
      // easeOutExpo — fast start, gentle settle
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ---------------------------------- Text reveal ------------------------ */

/** Word-by-word reveal for section headlines. */
export function TextGenerate({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const words = text.split(" ");

  if (reduced) return <span className={className}>{text}</span>;

  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      variants={{ visible: { transition: { staggerChildren: 0.045, delayChildren: delay } } }}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block"
          variants={{
            hidden: { opacity: 0, y: "0.35em", filter: "blur(6px)" },
            visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5 } },
          }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </motion.span>
  );
}

/* ---------------------------------- Aurora / beams background ---------- */

/** Slow drifting colour wash for dark hero bands. Purely decorative. */
export function AuroraBackground({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <motion.div
        className="absolute -top-1/3 left-1/4 size-[46rem] rounded-full bg-primary/25 blur-[120px]"
        animate={reduced ? undefined : { x: [0, 60, -30, 0], y: [0, 40, 20, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-1/3 right-1/5 size-[38rem] rounded-full bg-brand-accent/20 blur-[130px]"
        animate={reduced ? undefined : { x: [0, -50, 30, 0], y: [0, -30, -10, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export { motion, useScroll, useTransform, usePrefersReducedMotion };
export type { MotionValue };
