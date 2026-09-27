import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Flat neutral placeholder standing in for real property/package photography,
 * which the platform doesn't have yet (partners upload their own via Storage
 * post-launch). One quiet treatment everywhere it appears, including beside
 * real photos in the same grid, rather than a per-item accent color.
 */
export function MediaPlaceholder({
  icon: Icon,
  className,
}: {
  seed: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground/50 ring-1 ring-inset ring-border",
        className
      )}
      aria-hidden
    >
      <Icon className="size-8" strokeWidth={1.5} />
    </div>
  );
}
