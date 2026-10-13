import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TopProgressBar } from "./skeletons";

/**
 * Admin route fallbacks. Anything the real page renders from static text —
 * titles, table headers, tab labels, card headings, filter chips — is drawn
 * as real text with the real classes; only values that come from the database
 * are placeholders. That keeps the loading frame pixel-aligned with the page
 * that replaces it.
 */

const WIDTHS = ["w-3/4", "w-2/3", "w-1/2", "w-4/5", "w-1/3", "w-3/5"];

export function LoadingShell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={`Loading ${label}`} className={cn("space-y-6", className)}>
      <TopProgressBar />
      {children}
      <span className="sr-only">Loading</span>
    </div>
  );
}

type TitleProps = {
  title: string;
  /** Count badge beside the title; a string renders as static text. */
  badge?: boolean | string;
  /** Widths (tailwind classes) of the buttons on the right. */
  actions?: string[];
  /** Heading classes, where a page departs from the 2xl/semibold default. */
  className?: string;
};

export function Title({ title, badge, actions, className }: TitleProps) {
  const heading = (
    <div className="flex items-center gap-2">
      <h1 className={cn("font-heading text-2xl font-semibold", className)}>{title}</h1>
      {typeof badge === "string" ? <Badge variant="secondary">{badge}</Badge> : badge ? <Skeleton className="h-5 w-9 rounded-full" /> : null}
    </div>
  );
  if (!actions?.length) return heading;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {heading}
      <div className="flex gap-2">
        {actions.map((w, i) => (
          <Skeleton key={i} className={cn("h-8 rounded-lg", w)} />
        ))}
      </div>
    </div>
  );
}

/** Search box, selects and Apply button of the list pages. */
export function SearchBar({ placeholder, selects = 0, urgent }: { placeholder: string; selects?: number; urgent?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input disabled placeholder={placeholder} className="h-8 w-64 pl-8" aria-label="Search" />
      </div>
      {Array.from({ length: selects }, (_, i) => (
        <Skeleton key={i} className="h-8 w-36 rounded-lg" />
      ))}
      <Button size="sm" variant="outline" disabled>
        Apply
      </Button>
      {urgent ? <Skeleton className="h-8 w-20 rounded-full" /> : null}
    </div>
  );
}

/** Filter chips. The first is drawn active, as it is on a fresh visit. */
export function Chips({ labels, size = "md", counts }: { labels: string[]; size?: "sm" | "md"; counts?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label, i) => (
        <span
          key={label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border font-medium",
            size === "md" ? "px-3.5 py-1.5 text-sm" : "px-3 py-1 text-xs",
            i === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
          )}
        >
          {label}
          {counts ? <Skeleton className="h-4 w-5 rounded-full" /> : null}
        </span>
      ))}
    </div>
  );
}

/** Table in a card: real header row, placeholder cells. */
export function DataTable({
  headers,
  rows = 8,
  heading,
  cell,
}: {
  headers: string[];
  rows?: number;
  heading?: string;
  /** Overrides one column's placeholder, keyed by header index. */
  cell?: Record<number, ReactNode>;
}) {
  return (
    <Card className="overflow-hidden py-0">
      {heading ? (
        <CardHeader className="border-b pt-4 pb-3">
          <CardTitle className="text-base">{heading}</CardTitle>
        </CardHeader>
      ) : null}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }, (_, r) => (
              <TableRow key={r}>
                {headers.map((h, c) => (
                  <TableCell key={h}>
                    {cell?.[c] ?? <Skeleton className={cn("h-4", WIDTHS[(r + c) % WIDTHS.length])} />}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export function Pager() {
  return (
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-36" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

/** Status pill placeholder for table cells. */
export const PillCell = <Skeleton className="h-5 w-20 rounded-full" />;

/** Stat tiles: static label, placeholder value. */
export function StatTiles({ labels, className }: { labels: string[]; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {labels.map((label) => (
        <Card key={label}>
          <CardContent className="flex items-start justify-between gap-3 pt-6">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Skeleton className="mt-2 h-7 w-24" />
              <Skeleton className="mt-2 h-3 w-16" />
            </div>
            <Skeleton className="size-10 shrink-0 rounded-xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Compact dl strip used by the visa queue rail. */
export function CountRail({ labels }: { labels: string[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border text-sm sm:grid-cols-4 lg:grid-cols-7">
      {labels.map((label) => (
        <div key={label} className="flex flex-col gap-0.5 bg-secondary/40 px-4 py-3">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd>
            <Skeleton className="mt-1 h-6 w-8" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Card with a real heading and free-form content. */
export function Section({
  title,
  children,
  className,
  headingClassName,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  headingClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className={cn("text-base", headingClassName)}>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Label/value rows with the real labels. */
export function Fields({ labels, cols = 1 }: { labels: string[]; cols?: 1 | 2 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols === 2 && "sm:grid-cols-2")}>
      {labels.map((label) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1">
            <Skeleton className="h-4 w-40 max-w-full" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Form body: real labels over input placeholders, then a submit button. */
export function FormFields({ labels, button, cols = 1 }: { labels: string[]; button?: string; cols?: 1 | 2 }) {
  return (
    <div className="space-y-4">
      <div className={cn("grid gap-4", cols === 2 && "sm:grid-cols-2")}>
        {labels.map((label) => (
          <div key={label} className="space-y-1.5">
            <p className="text-sm font-medium">{label}</p>
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
      {button ? <Skeleton className="h-8 w-28 rounded-lg" /> : null}
    </div>
  );
}

export function Gallery({ title = "Photo gallery" }: { title?: string }) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
        ))}
      </div>
    </Section>
  );
}

/** Detail page head: back link, title, badges, trailing buttons. */
export function DetailHead({
  title,
  back,
  badges = 1,
  actions = [],
}: {
  title?: string;
  back?: string;
  badges?: number;
  actions?: string[];
}) {
  return (
    <div className="space-y-3">
      {back ? <Skeleton className="h-4 w-24" /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {title ? <h1 className="font-heading text-2xl font-semibold">{title}</h1> : <Skeleton className="h-8 w-64" />}
          {Array.from({ length: badges }, (_, i) => (
            <Skeleton key={i} className="h-5 w-20 rounded-full" />
          ))}
        </div>
        <div className="flex gap-2">
          {actions.map((w, i) => (
            <Skeleton key={i} className={cn("h-8 rounded-lg", w)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The real tab strip with its real labels; first tab active. */
export function TabBar({ labels }: { labels: string[] }) {
  return (
    <Tabs defaultValue={labels[0]}>
      <TabsList className="flex-wrap">
        {labels.map((label) => (
          <TabsTrigger key={label} value={label}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** Ranked request cards of the order queue and Private Umrah requests. */
export function RequestCards({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="font-heading text-lg font-bold text-muted-foreground/60">#{i + 1}</span>
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-72 max-w-full" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Skeleton className="h-6 w-28" />
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-32 rounded-lg" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Order card of Orders & Payments: header strip, line items, payments. */
export function OrderCards({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i} className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-muted/30 px-5 py-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-8 w-32 rounded-lg" />
              </div>
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 2 }, (_, j) => (
                <div key={j} className="flex items-center gap-4 px-5 py-3">
                  <Skeleton className="size-8 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Divided stat strip of the finance pages. */
export function StatStrip({ labels }: { labels: string[] }) {
  return (
    <dl
      className={cn(
        "grid divide-y divide-border rounded-lg border border-border bg-card sm:divide-x sm:divide-y-0",
        labels.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"
      )}
    >
      {labels.map((label) => (
        <div key={label} className="p-4">
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-2">
            <Skeleton className="h-7 w-28" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Grouped queue pills of the visa console. */
export function QueueGroups({ groups }: { groups: Array<{ label: string; queues: string[] }> }) {
  return (
    <nav className="space-y-2" aria-label="Queues">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 shrink-0 text-xs text-muted-foreground">{group.label}</span>
          {group.queues.map((q, i) => (
            <span
              key={q}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
                group.label === "My work" && i === 0
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              )}
            >
              {q}
              <Skeleton className="h-3.5 w-4" />
            </span>
          ))}
        </div>
      ))}
    </nav>
  );
}
