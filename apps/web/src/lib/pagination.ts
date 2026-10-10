/** Rows per page for admin tables. */
export const ADMIN_PAGE_SIZE = 25;

/** `?page=` as a positive integer; anything else is page 1. */
export function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Inclusive row bounds for PostgREST `.range()`. */
export function pageRange(page: number, size = ADMIN_PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}

/** Free text made safe to drop inside a PostgREST `ilike`/`or` filter. */
export function searchTerm(value: string | undefined): string | null {
  const cleaned = value?.trim().replace(/[%_,()*\\]/g, " ").replace(/\s+/g, " ");
  return cleaned ? cleaned : null;
}
