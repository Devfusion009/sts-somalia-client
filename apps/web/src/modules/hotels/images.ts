/**
 * Hotel images are stored in the public `hotel-images` bucket as
 * `<hotel_id>/<filename>` paths (or occasionally absolute URLs from imports).
 * Safe for both server and client components — only touches public env.
 */
export function hotelImageUrl(entry: unknown): string | null {
  if (typeof entry !== "string" || entry.length === 0) return null;
  if (entry.startsWith("http://") || entry.startsWith("https://")) return entry;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/hotel-images/${entry}` : null;
}

export function hotelImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.map(hotelImageUrl).filter((url): url is string => url !== null);
}

/**
 * A hotel's own brand mark — distinct from the property photo gallery
 * above. Stored in the public `hotel-logos` bucket as `<hotel_id>/<filename>`,
 * same shape as agencyLogoUrl (modules/agencies/logo.ts).
 */
export function hotelLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/hotel-logos/${path}` : null;
}

export function amenityLabel(amenity: string) {
  return amenity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
