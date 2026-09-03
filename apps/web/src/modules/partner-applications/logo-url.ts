/**
 * Application logos live in the public `partner-logos` bucket as
 * `<kind>/<application_id>/<filename>` paths (see
 * supabase/migrations/20260831000003_partner_logo_upload.sql) — same shape
 * as agencyLogoUrl in modules/agencies/logo.ts, but keyed by the
 * application itself rather than an approved agency, since it needs to be
 * visible to admins reviewing an application that isn't approved yet. Safe
 * for both server and client components — only touches public env.
 */
export function partnerLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/partner-logos/${path}` : null;
}
