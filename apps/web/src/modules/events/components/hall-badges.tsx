import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "Request",
  waitlisted: "Waitlisted",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  no_show: "No-show",
  failed: "Failed",
};

const STATUS_OVERRIDES = { no_show: "neutral" } as const;

export function HallStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusBadgeVariant(status, STATUS_OVERRIDES)} className={cn("capitalize", className)}>
      {STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

const WARN_TEXT = "text-[color-mix(in_oklch,var(--brand-gold),black_40%)] dark:text-brand-gold";

const PAYMENT: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "text-primary" },
  part_paid: { label: "Part paid", className: WARN_TEXT },
  unpaid: { label: "Unpaid", className: WARN_TEXT },
  refunded: { label: "Refunded", className: "text-muted-foreground" },
  none: { label: "—", className: "text-muted-foreground" },
};

export function HallPaymentLabel({ state }: { state: keyof typeof PAYMENT }) {
  const p = PAYMENT[state];
  return <span className={cn("text-xs font-medium", p.className)}>{p.label}</span>;
}
