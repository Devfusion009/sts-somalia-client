"use client";

import { usePathname } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Customer", "Service", "Details", "Review & pay"] as const;

/**
 * Where the counter is in customer → service → details → review & pay.
 * Derived from the route, so every desk page gets it from the layout.
 */
function currentStep(pathname: string, hasCustomer: boolean) {
  const segments = pathname.split("/").filter(Boolean);
  const rest = segments.slice(segments.indexOf("book") + 1).join("/");
  if (rest.startsWith("order/") || rest.startsWith("batch/")) return 3;
  if (rest) return 2;
  return hasCustomer ? 1 : 0;
}

export function DeskSteps({ hasCustomer }: { hasCustomer: boolean }) {
  const pathname = usePathname();
  const step = currentStep(pathname, hasCustomer);

  return (
    <nav aria-label="Booking steps">
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((label, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className="flex min-w-0 items-center gap-2"
            >
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn("h-px w-4 shrink-0 sm:w-8", done || current ? "bg-primary" : "bg-border")}
                />
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  done && "bg-primary text-primary-foreground",
                  current && "bg-foreground text-background",
                  !done && !current && "bg-muted text-muted-foreground"
                )}
              >
                {done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  "truncate",
                  current ? "font-medium text-foreground" : "text-muted-foreground max-sm:sr-only"
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
