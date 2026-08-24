import "server-only";
import { createClient } from "@/lib/supabase/server";

/** "spa, free wifi" -> ["spa", "free_wifi"] — shared amenity/event-type parsing for hotels and venues, admin and partner alike. */
export function commaList(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
}

/** "Label | https://url" per line — the property_links textarea format, shared by hotels and venues. */
export function parseLinks(input: string | undefined): Array<{ label: string; url: string }> {
  if (!input) return [];
  return input
    .split("\n")
    .map((line) => {
      const [label, ...rest] = line.split("|");
      return { label: label?.trim() ?? "", url: rest.join("|").trim() };
    })
    .filter((l) => l.label && l.url);
}

/** Replaces every property_links row for one hotel/venue with the freshly parsed set — full replace on save, same as amenities/event types. */
export async function replacePropertyLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parent: { hotelId?: string; venueId?: string },
  links: Array<{ label: string; url: string }>
) {
  if (parent.hotelId) {
    await supabase.from("property_links").delete().eq("hotel_id", parent.hotelId);
    if (links.length > 0) {
      const hotelId = parent.hotelId;
      await supabase
        .from("property_links")
        .insert(links.map((l, i) => ({ hotel_id: hotelId, label: l.label, url: l.url, sort_order: i })));
    }
  } else if (parent.venueId) {
    await supabase.from("property_links").delete().eq("venue_id", parent.venueId);
    if (links.length > 0) {
      const venueId = parent.venueId;
      await supabase
        .from("property_links")
        .insert(links.map((l, i) => ({ venue_id: venueId, label: l.label, url: l.url, sort_order: i })));
    }
  }
}
