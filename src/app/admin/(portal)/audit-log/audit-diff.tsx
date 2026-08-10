"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Json } from "@/lib/types/database.types";

function JsonBlock({ label, value }: { label: string; value: Json | null }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2.5 text-[11px] leading-relaxed">
        {value ? JSON.stringify(value, null, 2) : "—"}
      </pre>
    </div>
  );
}

export function AuditDiffToggle({
  oldData,
  newData,
}: {
  oldData: Json | null;
  newData: Json | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {open ? "Hide details" : "View details"}
      </button>
      {open ? (
        <div className={cn("mt-2 flex flex-col gap-3 sm:flex-row")}>
          <JsonBlock label="Before" value={oldData} />
          <JsonBlock label="After" value={newData} />
        </div>
      ) : null}
    </div>
  );
}
