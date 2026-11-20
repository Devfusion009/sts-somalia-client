import { cn } from "@/lib/utils";

/**
 * Shared band header: H2 → one-line lead, with an optional right-aligned
 * action (e.g. "View all →"). Centered for full-width bands, left-aligned
 * (with the action on the right) for list/grid bands. `tone="dark"` variants
 * sit on `bg-sidebar` bands. No eyebrow label — every caller's eyebrow string
 * duplicated the title next to it, so it was cut rather than replaced.
 */
export function SectionHeading({
  title,
  lead,
  action,
  align = "center",
  tone = "light",
  className,
}: {
  title: string;
  lead?: string;
  action?: React.ReactNode;
  align?: "center" | "left";
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        align === "left"
          ? "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
          : "flex flex-col items-center text-center",
        className
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        <h2
          className={cn(
            "font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl",
            align === "center" && "lg:text-5xl",
            dark ? "text-sidebar-foreground" : "text-foreground"
          )}
        >
          {title}
        </h2>
        {lead ? (
          <p
            className={cn(
              "mt-4 text-lg leading-relaxed",
              dark ? "text-sidebar-foreground/70" : "text-muted-foreground"
            )}
          >
            {lead}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
