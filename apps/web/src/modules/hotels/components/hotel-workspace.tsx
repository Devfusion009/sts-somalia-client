import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./hotel-workspace.module.css";

export function HotelWorkspaceHeader({ title, eyebrow, actions, meta }: {
  title: string;
  eyebrow: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          {eyebrow}
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {meta}
        {actions}
      </div>
    </header>
  );
}

export function HotelMetric({ label, value, detail, featured = false }: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  featured?: boolean;
}) {
  return (
    <div className={cn(styles.metric, featured && styles.featuredMetric)}>
      <dt className={cn("text-xs font-medium", featured ? "text-sidebar-foreground/70" : "text-muted-foreground")}>{label}</dt>
      <dd className="mt-4 font-heading text-2xl leading-tight font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-[2rem]">{value}</dd>
      {detail ? <dd className={cn("mt-3 text-xs", featured ? "text-sidebar-foreground/65" : "text-muted-foreground")}>{detail}</dd> : null}
    </div>
  );
}

export { styles as hotelStyles };
