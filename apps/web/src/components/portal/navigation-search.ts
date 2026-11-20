import { stripPortalPrefix } from "@/lib/subdomain";

type SearchableGroup = {
  label: string;
  items: Array<{ label: string; searchTerms?: string }>;
};

/** Match every word against the section and page labels without changing the source menu. */
export function filterNavigationGroups<T extends SearchableGroup>(groups: T[], query: string): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return groups;
  return groups.flatMap((group) => {
    const items = group.items.filter((item) => {
      const text = `${group.label} ${item.label} ${item.searchTerms ?? ""}`.toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    });
    return items.length ? [{ ...group, items }] : [];
  });
}
/** Resolve detail pages and legacy catalog paths to one canonical destination. */
export function findActiveNavigationItem<T extends { href: string; activePaths?: string[] }>(items: T[], pathname: string): T | undefined {
  const current = stripPortalPrefix(pathname);
  return items.flatMap((item) => [item.href, ...(item.activePaths ?? [])].map((path) => ({
    item,
    path: stripPortalPrefix(path) ?? path,
  })))
    .filter(({ path }) => current === path || (path !== "/" && current?.startsWith(`${path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0]?.item;
}
