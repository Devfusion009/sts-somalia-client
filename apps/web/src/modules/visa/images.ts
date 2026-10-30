/**
 * Visa cover photos. An admin upload lives in the public `visa-images` bucket
 * as `<visa_type_id>/<filename>`; a visa type without one falls back to the
 * committed per-country photo. Safe for server and client components — only
 * touches public env.
 */
export const DESTINATION_PHOTOS: Record<string, string> = {
  AE: "/marketing/dest-visa-ae.jpg",
  TR: "/marketing/dest-visa-tr.jpg",
  SA: "/marketing/dest-visa-sa.jpg",
  EG: "/marketing/dest-cairo.webp",
  ET: "/marketing/dest-visa-et.jpg",
  KE: "/marketing/dest-visa-ke.png",
  MY: "/marketing/dest-visa-my.png",
};

export function visaImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/visa-images/${path}` : null;
}

/** The photo a visitor sees for this visa type: the admin's upload, else the country default. */
export function visaCardImage(visa: { cover_image: string | null; destination_country_code: string }): string | null {
  return visaImageUrl(visa.cover_image) ?? DESTINATION_PHOTOS[visa.destination_country_code] ?? null;
}
