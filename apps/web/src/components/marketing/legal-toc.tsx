"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type LegalTocItem = { id: string; number: string; title: string };

/**
 * Contents list for a legal page: a sticky rail on wide screens that follows
 * the section being read, and a collapsible list on phones.
 */
export function LegalToc({ items }: { items: LegalTocItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-25% 0px -65% 0px" }
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <>
      <details className="group rounded-2xl border border-border bg-card shadow-xs lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-heading text-sm font-semibold [&::-webkit-details-marker]:hidden">
          Contents
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground tabular-nums">
            {items.length} sections
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </span>
        </summary>
        <ol className="grid gap-0.5 border-t border-border px-2 py-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="flex gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="w-5 shrink-0 font-semibold text-primary tabular-nums">{item.number}</span>
                {item.title}
              </a>
            </li>
          ))}
        </ol>
      </details>

      <nav aria-label="Contents" className="hidden lg:block">
        <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pb-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">On this page</p>
          <ol className="mt-4 border-l border-border">
            {items.map((item) => {
              const current = item.id === active;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={current ? "location" : undefined}
                    className={cn(
                      "-ml-px flex gap-3 border-l-2 py-1.5 pr-2 pl-4 text-sm leading-snug transition-colors",
                      current
                        ? "border-primary font-medium text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    <span className="w-5 shrink-0 tabular-nums">{item.number}</span>
                    {item.title}
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </>
  );
}
