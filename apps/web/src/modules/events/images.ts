/**
 * Venue gallery images live in the public `venue-images` bucket as
 * `<venue_id>/<filename>` paths. Array order IS display order — index 0 is the
 * cover shot.
 *
 * Mirrors modules/umrah/images.ts and modules/hotels/images.ts exactly, right
 * down to the root-relative branch. Safe for both server and client components
 * — only touches public env.
 */
export function venueImageUrl(entry: unknown): string | null {
  if (typeof entry !== "string" || entry.length === 0) return null;
  if (entry.startsWith("http://") || entry.startsWith("https://")) return entry;
  // Root-relative paths are repo-committed marketing assets under public/
  // (e.g. "/events/ballroom.webp"). Without this branch they'd be treated as a
  // bucket key and prefixed into a 404 — and unlike admin uploads these have to
  // exist in every environment and survive a database reset.
  if (entry.startsWith("/")) return entry;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/venue-images/${entry}` : null;
}

export function venueImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.map(venueImageUrl).filter((url): url is string => url !== null);
}
