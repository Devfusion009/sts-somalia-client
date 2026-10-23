import { publicVenueDetailSchema, publicVenueSchema, type PublicVenue, type PublicVenueDetail } from "@sts/shared-types";

/**
 * Row → public DTO. Parsing through the shared schema drops any column not
 * in the contract and normalises the jsonb lists, so what a browser gets
 * can't widen when the table does.
 */
export function toPublicVenue(row: unknown): PublicVenue {
  return publicVenueSchema.parse(row);
}

/** Detail adds links and published reviews only. */
export function toPublicVenueDetail(row: Record<string, unknown>): PublicVenueDetail {
  const reviews = Array.isArray(row.property_reviews) ? row.property_reviews : [];
  return publicVenueDetailSchema.parse({
    ...row,
    property_links: Array.isArray(row.property_links) ? row.property_links : [],
    property_reviews: reviews.filter((r: { status?: string }) => r.status === "published"),
  });
}
