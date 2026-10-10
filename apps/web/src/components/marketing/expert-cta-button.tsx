import { ArrowRight, Headset } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * High-emphasis "talk to a person" link for marketing pages. Tonal teal
 * rather than a multi-hue gradient: a lighter top edge, a darker 1px rim and
 * a teal-tinted drop shadow give it depth while staying inside the brand.
 * The arrow sits in a solid chip so the affordance reads at a glance.
 */
export function ExpertCtaButton({
  href,
  children,
  external = true,
  className,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "group/cta relative inline-flex h-14 w-full items-center gap-3 overflow-hidden rounded-xl pr-2.5 pl-2.5 text-left",
        "border border-[color-mix(in_oklch,var(--primary),black_22%)] text-primary-foreground",
        "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--primary),white_8%)_0%,var(--primary)_45%,color-mix(in_oklch,var(--primary),black_14%)_100%)]",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.24),0_1px_2px_rgb(14_39_35/0.14),0_10px_24px_-10px_color-mix(in_oklch,var(--primary),transparent_35%)]",
        "transition-[transform,box-shadow,filter] duration-200 ease-out",
        "hover:-translate-y-px hover:brightness-[1.04] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.24),0_2px_4px_rgb(14_39_35/0.14),0_16px_32px_-12px_color-mix(in_oklch,var(--primary),transparent_25%)]",
        "active:translate-y-0 active:brightness-95 active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.18)]",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        className,
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-foreground/12 ring-1 ring-primary-foreground/20 ring-inset">
        <Headset className="size-[18px]" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1 truncate font-heading text-[15px] font-semibold tracking-tight">
        {children}
        {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-foreground text-primary shadow-sm transition-transform duration-200 ease-out group-hover/cta:translate-x-0.5">
        <ArrowRight className="size-[18px]" strokeWidth={2.5} />
      </span>
    </a>
  );
}
