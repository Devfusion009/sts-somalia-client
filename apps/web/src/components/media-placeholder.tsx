import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const GRADIENTS = [
  "from-sky-500 to-blue-700",
  "from-orange-400 to-rose-600",
  "from-emerald-500 to-teal-700",
  "from-violet-500 to-indigo-700",
  "from-amber-400 to-orange-600",
  "from-cyan-500 to-sky-700",
];

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic gradient placeholder standing in for real property/package
 * photography, which the platform doesn't have yet (partners upload their
 * own via Storage post-launch). Same seed always renders the same gradient.
 */
export function MediaPlaceholder({
  seed,
  icon: Icon,
  className,
}: {
  seed: string;
  icon: LucideIcon;
  className?: string;
}) {
  const gradient = GRADIENTS[hashSeed(seed) % GRADIENTS.length];

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br text-white/90",
        gradient,
        className
      )}
      aria-hidden
    >
      <Icon className="size-10 opacity-80" strokeWidth={1.5} />
    </div>
  );
}
