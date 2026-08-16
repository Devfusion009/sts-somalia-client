"use client";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "status", label: "Pending first" },
];

/** A plain GET form so this stays server-rendered and shareable-by-URL — the select just auto-submits on change, carrying every other active filter along as hidden fields so switching sort never drops them. */
export function SortSelect({ value, hidden }: { value: string; hidden: Record<string, string | undefined> }) {
  return (
    <form method="get" className="flex items-center gap-2">
      {Object.entries(hidden).map(([name, val]) => (val ? <input key={name} type="hidden" name={name} value={val} /> : null))}
      <label htmlFor="sort-select" className="text-xs font-medium text-muted-foreground">
        Sort
      </label>
      <select
        id="sort-select"
        name="sort"
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </form>
  );
}
