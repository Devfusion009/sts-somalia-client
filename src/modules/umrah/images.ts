/**
 * Umrah package gallery images live in the public `umrah-images` bucket as
 * `<package_id>/<filename>` paths. Array order IS display order — index 0
 * is the cover shot (see setUmrahCoverImage in admin-actions.ts).
 *
 * Mirrors modules/hotels/images.ts exactly; safe for both server and client
 * components — only touches public env.
 */
export function umrahImageUrl(entry: unknown): string | null {
  if (typeof entry !== "string" || entry.length === 0) return null;
  if (entry.startsWith("http://") || entry.startsWith("https://")) return entry;
  // Root-relative paths are repo-committed marketing assets under public/
  // (e.g. "/umrah/madinah-courtyard.webp"). Without this branch they'd be
  // treated as a bucket key and prefixed into a 404 — and unlike admin uploads
  // these have to survive a database reset and exist in every environment, so
  // they can't live in local Storage.
  if (entry.startsWith("/")) return entry;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/umrah-images/${entry}` : null;
}

export function umrahImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.map(umrahImageUrl).filter((url): url is string => url !== null);
}

/** Raw storage paths (not URLs) — the admin gallery needs these to delete/reorder. */
export function umrahImagePaths(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.filter((p): p is string => typeof p === "string" && p.length > 0);
}

export const MEAL_PLAN_LABELS: Record<string, string> = {
  none: "No meals included",
  breakfast: "Breakfast only",
  half_board: "Half board (breakfast + dinner)",
  full_board: "Full board (all meals)",
};

export function sharingLabel(sharing: number): string {
  if (sharing === 1) return "Single occupancy";
  if (sharing === 2) return "Double sharing";
  if (sharing === 3) return "Triple sharing";
  if (sharing === 4) return "Quad sharing";
  return `${sharing} sharing`;
}
