import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Back navigation for every portal's detail page: one round icon button, no
 * label text (the destination goes in `label` for screen readers). Replaces
 * the assorted "← All agencies" style ghost links that used to differ from
 * page to page.
 */
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:size-10",
        className
      )}
    >
      <ArrowLeft className="size-5" strokeWidth={2.5} aria-hidden="true" />
    </Link>
  );
}
