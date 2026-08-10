import { cn } from "@/lib/utils";

/**
 * Shared band header: eyebrow → H2 → one-line lead, with an optional
 * right-aligned action (e.g. "View all →"). Centered for full-width bands,
 * left-aligned (with the action on the right) for list/grid bands.
 * `tone="dark"` variants sit on `bg-sidebar` bands.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  action,
  align = "center",
  tone = "light",
  className,
}: {
  eyebrow: string;
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
        <p
          className={cn(
            "text-sm font-semibold tracking-[0.14em] uppercase",
            dark ? "text-sidebar-primary" : "text-primary"
          )}
        >
          {eyebrow}
        </p>
        <h2
          className={cn(
            "mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl",
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
