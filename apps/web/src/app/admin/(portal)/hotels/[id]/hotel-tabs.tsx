import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPendingBookingCount } from "@/modules/hotels/manager-queries";
import { getOpenRequestCount } from "@/modules/hotels/refund-queries";
import { BackLink } from "@/components/back-link";
import { cn } from "@/lib/utils";

export type HotelTabKey = "overview" | "bookings" | "rates" | "refunds" | "guests" | "reports";

const TABS: Array<{ key: HotelTabKey; label: string; path: string }> = [
  { key: "overview", label: "Overview", path: "" },
  { key: "bookings", label: "Bookings", path: "/bookings" },
  { key: "rates", label: "Rates", path: "/rates" },
  { key: "refunds", label: "Refunds", path: "/refunds" },
  { key: "guests", label: "Guests", path: "/guests" },
  { key: "reports", label: "Reports", path: "/reports" },
];

/** One hotel's admin sections. Counts flag work waiting in Bookings and Refunds. */
export async function HotelTabs({ id, active }: { id: string; active: HotelTabKey }) {
  const [pending, openRequests] = await Promise.all([getPendingBookingCount(id), getOpenRequestCount(id)]);
  const badge: Partial<Record<HotelTabKey, number>> = { bookings: pending, refunds: openRequests };

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border" aria-label="Hotel sections">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/admin/hotels/${id}${tab.path}`}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab.key === active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {badge[tab.key] ? (
            <span className="rounded-full bg-brand-gold/15 px-1.5 text-xs font-semibold text-brand-gold tabular-nums">
              {badge[tab.key]}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** Header for every admin hotel section page except the overview, which has its own. */
export async function HotelSectionHeader({ id, active }: { id: string; active: HotelTabKey }) {
  const supabase = await createClient();
  const { data: hotel } = await supabase.from("hotels").select("id, name, city").eq("id", id).maybeSingle();
  if (!hotel) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackLink href={`/admin/hotels/${id}`} label={hotel.name} />
        <div>
          <p className="font-heading text-lg font-semibold leading-tight">{hotel.name}</p>
          <p className="text-sm text-muted-foreground">{hotel.city}</p>
        </div>
      </div>
      <HotelTabs id={id} active={active} />
    </div>
  );
}
