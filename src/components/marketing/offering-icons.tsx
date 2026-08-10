"use client";

import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/components/ui/aceternity/motion-primitives";
import { cn } from "@/lib/utils";

/**
 * Duotone line-art icon set for the "Get more with STS" band.
 *
 * Hand-authored rather than generated: six icons need identical stroke weight,
 * cap style and optical weight to sit in a row, and every shape is stroke-only
 * (`fill="none"`) so Motion can animate `pathLength` to draw each one on as the
 * card scrolls into view. Colours are the brand tokens, so the set follows
 * light/dark automatically.
 */

const ORANGE = "var(--brand-accent)";
const TEAL = "var(--primary)";

/** Each shape draws itself in sequence; parent staggers the children. */
const drawVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
      opacity: { duration: 0.15 },
    },
  },
};

function DrawIcon({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-full", className)}
      // Reduced motion jumps straight to the drawn state.
      initial={reduced ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
      variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: delay } } }}
    >
      {children}
    </motion.svg>
  );
}

type IconProps = { className?: string; delay?: number };
const P = motion.path;
const C = motion.circle;
const L = motion.line;
const R = motion.rect;

/** Gift box — rewards on every booking. */
export function GiftIcon({ className, delay }: IconProps) {
  return (
    <DrawIcon className={className} delay={delay}>
      <R x="10" y="21" width="44" height="11" rx="2.5" stroke={ORANGE} variants={drawVariants} />
      <P d="M14 32v20a2.5 2.5 0 0 0 2.5 2.5h31A2.5 2.5 0 0 0 50 52V32" stroke={ORANGE} variants={drawVariants} />
      <L x1="32" y1="21" x2="32" y2="54.5" stroke={TEAL} variants={drawVariants} />
      <P d="M32 21c-6.5 0-11.5-1.8-11.5-6a5.2 5.2 0 0 1 9.4-3c1.3 1.7 2.1 5.2 2.1 9Z" stroke={TEAL} variants={drawVariants} />
      <P d="M32 21c6.5 0 11.5-1.8 11.5-6a5.2 5.2 0 0 0-9.4-3c-1.3 1.7-2.1 5.2-2.1 9Z" stroke={TEAL} variants={drawVariants} />
    </DrawIcon>
  );
}

/** Secured vault — digital payments held safely. */
export function VaultIcon({ className, delay }: IconProps) {
  return (
    <DrawIcon className={className} delay={delay}>
      <R x="11" y="11" width="42" height="42" rx="8" stroke={ORANGE} variants={drawVariants} />
      <P d="M20 11h-4a5 5 0 0 0-5 5v4" stroke={ORANGE} variants={drawVariants} />
      <P d="M44 53h4a5 5 0 0 0 5-5v-4" stroke={ORANGE} variants={drawVariants} />
      <L x1="32" y1="21" x2="32" y2="43" stroke={TEAL} variants={drawVariants} />
      <L x1="22.5" y1="26.5" x2="41.5" y2="37.5" stroke={TEAL} variants={drawVariants} />
      <L x1="22.5" y1="37.5" x2="41.5" y2="26.5" stroke={TEAL} variants={drawVariants} />
      <C cx="32" cy="32" r="4.5" stroke={TEAL} variants={drawVariants} />
    </DrawIcon>
  );
}

/**
 * Knockout disc painted in the card's own background colour. Sits between the
 * orange base shape and the teal badge so the base's outline is cut away where
 * the badge overlaps, instead of the two sets of lines crossing each other.
 * Fill-only, so it is not part of the `pathLength` draw-on (a filled shape has
 * no stroke to animate) — on a matching background it is invisible anyway.
 */
function Knockout({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="var(--card)" stroke="none" />;
}

/** Calendar with a reschedule arrow — flexible cancellation. */
export function FlexibleIcon({ className, delay }: IconProps) {
  return (
    <DrawIcon className={className} delay={delay}>
      <R x="7" y="13" width="30" height="28" rx="4" stroke={ORANGE} variants={drawVariants} />
      <L x1="7" y1="22" x2="37" y2="22" stroke={ORANGE} variants={drawVariants} />
      <L x1="15" y1="8" x2="15" y2="17" stroke={ORANGE} variants={drawVariants} />
      <L x1="29" y1="8" x2="29" y2="17" stroke={ORANGE} variants={drawVariants} />

      <Knockout cx={45} cy={43} r={12.5} />
      {/* 270° arc, right → bottom → left → top, leaving the upper-right open */}
      <P d="M53 43A8 8 0 1 1 45 35" stroke={TEAL} variants={drawVariants} />
      {/* Real chevron arrowhead at the arc's end, pointing along its tangent */}
      <P d="M41.8 31.8 45 35l-3.2 3.2" stroke={TEAL} variants={drawVariants} />
    </DrawIcon>
  );
}

/** Card with a cancel badge — zero gateway charges. */
export function NoFeesIcon({ className, delay }: IconProps) {
  return (
    <DrawIcon className={className} delay={delay}>
      <R x="6" y="16" width="33" height="23" rx="3.5" stroke={ORANGE} variants={drawVariants} />
      <L x1="6" y1="24" x2="39" y2="24" stroke={ORANGE} variants={drawVariants} />
      <L x1="11" y1="32" x2="19" y2="32" stroke={ORANGE} variants={drawVariants} />

      <Knockout cx={45} cy={42} r={12.5} />
      <C cx="45" cy="42" r="9" stroke={TEAL} variants={drawVariants} />
      <L x1="41.2" y1="38.2" x2="48.8" y2="45.8" stroke={TEAL} variants={drawVariants} />
      <L x1="48.8" y1="38.2" x2="41.2" y2="45.8" stroke={TEAL} variants={drawVariants} />
    </DrawIcon>
  );
}

/** Headset — round-the-clock human support. */
export function SupportIcon({ className, delay }: IconProps) {
  return (
    <DrawIcon className={className} delay={delay}>
      <P d="M13 37v-5a19 19 0 0 1 38 0v5" stroke={ORANGE} variants={drawVariants} />
      <R x="7" y="33" width="11" height="17" rx="5.5" stroke={ORANGE} variants={drawVariants} />
      <R x="46" y="33" width="11" height="17" rx="5.5" stroke={ORANGE} variants={drawVariants} />
      <P d="M51.5 50v1.5a6.5 6.5 0 0 1-6.5 6.5h-6" stroke={TEAL} variants={drawVariants} />
      <R x="26" y="54" width="12" height="8" rx="4" stroke={TEAL} variants={drawVariants} />
    </DrawIcon>
  );
}

/** Two people with a link between — agent & API connectivity. */
export function ConnectIcon({ className, delay }: IconProps) {
  return (
    <DrawIcon className={className} delay={delay}>
      <C cx="16" cy="22" r="6.5" stroke={ORANGE} variants={drawVariants} />
      <P d="M5 43a11 11 0 0 1 22 0" stroke={ORANGE} variants={drawVariants} />
      <C cx="48" cy="22" r="6.5" stroke={ORANGE} variants={drawVariants} />
      <P d="M37 43a11 11 0 0 1 22 0" stroke={ORANGE} variants={drawVariants} />
      <L x1="27" y1="31" x2="36" y2="31" stroke={TEAL} variants={drawVariants} />
      <P d="M33 28l3.5 3-3.5 3" stroke={TEAL} variants={drawVariants} />
      <L x1="37" y1="53" x2="27" y2="53" stroke={TEAL} variants={drawVariants} />
      <P d="M31 50l-3.5 3 3.5 3" stroke={TEAL} variants={drawVariants} />
    </DrawIcon>
  );
}
