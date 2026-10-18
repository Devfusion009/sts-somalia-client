import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPendingHallBookingCount } from "@/modules/events/venue-manager-queries";
import { getOpenVenueRequestCount } from "@/modules/events/venue-refund-queries";
import { BackLink } from "@/components/back-link";
import { cn } from "@/lib/utils";

export type VenueTabKey = "overview" | "bookings" | "refunds";

const TABS: Array<{ key: VenueTabKey; label: string; path: string }> = [
  { key: "overview", label: "Overview", path: "" },
  { key: "bookings", label: "Bookings", path: "/bookings" },
  { key: "refunds", label: "Refunds", path: "/refunds" },
];

/** One venue's admin sections. Counts flag requests waiting in Bookings and Refunds. */
export async function VenueTabs({ id, active }: { id: string; active: VenueTabKey }) {
  const [pending, openRequests] = await Promise.all([getPendingHallBookingCount(id), getOpenVenueRequestCount(id)]);
  const badge: Partial<Record<VenueTabKey, number>> = { bookings: pending, refunds: openRequests };

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border" aria-label="Venue sections">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/admin/events/${id}${tab.path}`}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab.key === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {badge[tab.key] ? (
            <span className="rounded-full bg-brand-gold/15 px-1.5 text-xs font-semibold text-brand-gold tabular-nums">{badge[tab.key]}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export async function VenueSectionHeader({ id, active }: { id: string; active: VenueTabKey }) {
  const supabase = await createClient();
  const { data: venue } = await supabase.from("event_venues").select("id, name, city").eq("id", id).maybeSingle();
  if (!venue) notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackLink href={`/admin/events/${id}`} label={venue.name} />
        <div>
          <p className="font-heading text-lg leading-tight font-semibold">{venue.name}</p>
          <p className="text-sm text-muted-foreground">{venue.city}</p>
        </div>
      </div>
      <VenueTabs id={id} active={active} />
    </div>
  );
}
