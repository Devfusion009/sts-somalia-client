export type DateRangeKey = "24h" | "7d" | "30d" | "90d" | "custom";

export type ResolvedDateRange = {
  key: DateRangeKey;
  label: string;
  from: Date;
  to: Date;
  /** The immediately-preceding window of equal length, for %-change comparisons. */
  previousFrom: Date;
  previousTo: Date;
  /** Suggested chart bucket granularity for a range this long. */
  granularity: "hour" | "day" | "week";
};

const RANGE_HOURS: Record<Exclude<DateRangeKey, "custom">, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
};

const RANGE_LABELS: Record<DateRangeKey, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  custom: "Custom range",
};

/** Reads ?range=7d or ?from=...&to=... (ISO dates) from admin dashboard/report searchParams. */
export function resolveDateRange(params: { range?: string; from?: string; to?: string }): ResolvedDateRange {
  const now = new Date();

  if (params.range === "custom" && params.from && params.to) {
    const from = new Date(`${params.from}T00:00:00`);
    const to = new Date(`${params.to}T23:59:59.999`);
    const spanMs = to.getTime() - from.getTime();
    return {
      key: "custom",
      label: RANGE_LABELS.custom,
      from,
      to,
      previousFrom: new Date(from.getTime() - spanMs),
      previousTo: new Date(from.getTime() - 1),
      granularity: spanMs > 45 * 86_400_000 ? "week" : "day",
    };
  }

  const key: Exclude<DateRangeKey, "custom"> =
    params.range === "24h" || params.range === "7d" || params.range === "90d" ? params.range : "30d";

  const hours = RANGE_HOURS[key];
  const to = now;
  const from = new Date(now.getTime() - hours * 3_600_000);
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - hours * 3_600_000);

  return {
    key,
    label: RANGE_LABELS[key],
    from,
    to,
    previousFrom,
    previousTo,
    granularity: key === "24h" ? "hour" : key === "90d" ? "week" : "day",
  };
}

/** % change from previous to current, null when the previous period had no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Bucketing — shared by any dashboard building a time-series/sparkline over
// a ResolvedDateRange (admin dashboard, agent dashboard, ...).
// ---------------------------------------------------------------------------

export type BucketGranularity = "hour" | "day" | "week";

export function bucketKey(date: Date, granularity: BucketGranularity): string {
  if (granularity === "hour") {
    return date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  }
  if (granularity === "week") {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return weekStart.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function bucketLabel(key: string, granularity: BucketGranularity): string {
  if (granularity === "hour") {
    return new Date(`${key}:00:00`).toLocaleTimeString(undefined, { hour: "2-digit" });
  }
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function enumerateBuckets(from: Date, to: Date, granularity: BucketGranularity): string[] {
  const stepMs = granularity === "hour" ? 3_600_000 : granularity === "week" ? 7 * 86_400_000 : 86_400_000;
  const keys: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    keys.push(bucketKey(cursor, granularity));
    cursor.setTime(cursor.getTime() + stepMs);
  }
  return keys;
}
