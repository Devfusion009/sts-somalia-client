"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ReportFilters({
  defaultFrom,
  defaultTo,
  defaultType,
  verticals,
}: {
  defaultFrom?: string;
  defaultTo?: string;
  defaultType?: string;
  verticals: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(defaultFrom ?? "");
  const [to, setTo] = useState(defaultTo ?? "");
  const [type, setType] = useState(defaultType ?? "");

  function apply() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (type) params.set("type", type);
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  function clear() {
    setFrom("");
    setTo("");
    setType("");
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-9 items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Filter className="size-3.5" /> Filters
      </div>
      <div className="space-y-1">
        <Label htmlFor="reportFrom" className="text-xs">From</Label>
        <Input id="reportFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="reportTo" className="text-xs">To</Label>
        <Input id="reportTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="reportType" className="text-xs">Product</Label>
        <select id="reportType" value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
          <option value="">All products</option>
          {Object.entries(verticals).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Button size="sm" onClick={apply}>
        Apply
      </Button>
      {(from || to || type) && (
        <Button size="sm" variant="ghost" onClick={clear}>
          Clear
        </Button>
      )}
    </div>
  );
}
