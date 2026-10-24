import { Badge } from "@/components/ui/badge";
import { UMRAH_STAGE_LABELS, UMRAH_STAGE_VARIANTS, type UmrahStage } from "./stages";

export function StageBadge({ stage }: { stage: UmrahStage }) {
  return <Badge variant={UMRAH_STAGE_VARIANTS[stage]}>{UMRAH_STAGE_LABELS[stage]}</Badge>;
}

/** Date-only columns are calendar days, so they are parsed as local midnight, not UTC. */
export function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Flight times are stored as the wall-clock time entered (UTC-tagged), so they are read back in UTC. */
export function formatFlightTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
