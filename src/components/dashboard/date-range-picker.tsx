"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DateRangeKey } from "@/lib/date-range";

const OPTIONS: { key: Exclude<DateRangeKey, "custom">; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
];

/**
 * Drives every date-scoped chart/table on a dashboard via URL search params
 * (?range=7d or ?range=custom&from=...&to=...) so the page stays
 * server-rendered — this component only ever navigates, it holds no
 * data-fetching state itself. Route-agnostic (uses the current pathname),
 * so it works unmodified on both the admin and agent dashboards.
 */
export function DateRangePicker({ currentKey }: { currentKey: DateRangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setRange(key: Exclude<DateRangeKey, "custom">) {
    router.push(`${pathname}?range=${key}`);
  }

  function setCustom(from: string, to: string) {
    if (!from || !to) return;
    router.push(`${pathname}?range=custom&from=${from}&to=${to}`);
  }

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-border p-1">
        {OPTIONS.map((opt) => (
          <Button
            key={opt.key}
            type="button"
            size="sm"
            variant="ghost"
            className={cn("h-7 px-2.5", currentKey === opt.key && "bg-primary/10 text-primary")}
            onClick={() => setRange(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Label htmlFor="dr-from" className="sr-only">
          From
        </Label>
        <Input
          id="dr-from"
          type="date"
          defaultValue={from}
          onChange={(e) => setCustom(e.target.value, to)}
          className="h-8 w-36 text-xs"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          id="dr-to"
          type="date"
          defaultValue={to}
          onChange={(e) => setCustom(from, e.target.value)}
          className="h-8 w-36 text-xs"
        />
      </div>
    </div>
  );
}
