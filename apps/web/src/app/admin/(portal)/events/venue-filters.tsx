"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "suspended", label: "Suspended" },
];

/**
 * Search-as-you-type plus status and town filters. State lives in the URL so
 * the server page does the filtering and a filtered view can be shared.
 */
export function VenueFilters({ cities }: { cities: { name: string; count: number }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const status = params.get("status") ?? "";
  const city = params.get("city") ?? "";

  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    const qs = sp.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function onType(value: string) {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: value.trim() }), 250);
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={text}
          onChange={(e) => onType(e.target.value)}
          placeholder="Search venue or town"
          aria-label="Search venues"
          className="h-10 pr-9 pl-9"
        />
        {pending ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : text ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onType("")}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <Chip key={s.value} active={status === s.value} onClick={() => push({ status: s.value })}>
              {s.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={city === ""} onClick={() => push({ city: "" })}>
            All towns
          </Chip>
          {cities.map((c) => (
            <Chip key={c.name} active={city === c.name} onClick={() => push({ city: c.name })}>
              {c.name}
              <span className="ml-1.5 text-xs opacity-60">{c.count}</span>
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
