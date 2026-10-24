"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Json } from "@/lib/types/database.types";

function JsonBlock({ label, value }: { label: string; value: Json | null }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2.5 font-mono text-[11px] leading-relaxed">
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
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {open ? (
          <ChevronDown className="size-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3.5" aria-hidden="true" />
        )}
        {open ? "Hide details" : "View details"}
      </button>
      {open ? (
        <div className="mt-2 flex w-[min(36rem,80vw)] flex-col gap-3 sm:flex-row">
          <JsonBlock label="Before" value={oldData} />
          <JsonBlock label="After" value={newData} />
        </div>
      ) : null}
    </div>
  );
}
