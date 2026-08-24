/**
 * PipelineStatus + pipelineStatus() moved to packages/shared-types (phase
 * 4b) — re-exported here, not redefined, so existing imports need no
 * changes. PIPELINE_STATUS_STYLES stays local: it's Tailwind class
 * strings, presentation, not data a backend module has any use for.
 */
export type { PipelineStatus } from "@sts/shared-types";
export { pipelineStatus } from "@sts/shared-types";
import type { PipelineStatus } from "@sts/shared-types";

export const PIPELINE_STATUS_STYLES: Record<PipelineStatus, string> = {
  Pending: "bg-brand-gold/15 text-brand-gold",
  "Payment Received": "bg-chart-3/10 text-chart-3",
  Confirmed: "bg-primary/10 text-primary",
  Completed: "bg-primary/10 text-primary",
  Cancelled: "bg-destructive/10 text-destructive",
};
