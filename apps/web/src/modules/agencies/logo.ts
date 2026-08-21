/**
 * Agency logos live in the public `agency-logos` bucket as
 * `<agency_id>/<filename>` paths — same shape as hotelImageUrl in
 * modules/hotels/images.ts. Safe for both server and client components —
 * only touches public env.
 */
export function agencyLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/agency-logos/${path}` : null;
}
