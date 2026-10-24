"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", path: "" },
  { label: "Bookings", path: "/bookings", badge: "requests" },
  { label: "Calendar", path: "/calendar" },
  { label: "Refunds", path: "/refunds", badge: "refunds" },
  { label: "Listing", path: "/listing" },
] as const;

/** One venue's admin sections; the badges flag requests waiting in Bookings and Refunds. */
export function VenueTabs({ id, counts }: { id: string; counts: { requests: number; refunds: number } }) {
  const pathname = usePathname();
  const root = `/admin/events/${id}`;
  // Matched on the part after the venue id: on the admin subdomain the
  // browser path has no /admin prefix.
  const marker = `/events/${id}`;
  const rest = pathname.slice(pathname.indexOf(marker) + marker.length);
  const active = [...TABS].reverse().find((t) => (t.path ? rest.startsWith(t.path) : rest === "" || rest === "/"));

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border" aria-label="Venue sections">
      {TABS.map((tab) => {
        const count = "badge" in tab ? counts[tab.badge] : 0;
        const current = active?.path === tab.path;
        return (
          <Link
            key={tab.label}
            href={root + tab.path}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:py-3",
              current ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {count ? (
              <Badge variant="warning" className="h-4.5 px-1.5 tabular-nums" aria-label={`${count} waiting`}>
                {count}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
