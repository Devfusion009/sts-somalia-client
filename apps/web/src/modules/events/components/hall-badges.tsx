import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HALL_STATUS_BADGE } from "@/modules/events/venue-desk-types";

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

export function HallStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={cn("border-transparent", HALL_STATUS_BADGE[status] ?? "bg-muted text-muted-foreground", className)}>
      {STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

const PAYMENT: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "text-primary" },
  part_paid: { label: "Part paid", className: "text-brand-gold" },
  unpaid: { label: "Unpaid", className: "text-brand-gold" },
  refunded: { label: "Refunded", className: "text-destructive" },
  none: { label: "—", className: "text-muted-foreground" },
};

export function HallPaymentLabel({ state }: { state: keyof typeof PAYMENT }) {
  const p = PAYMENT[state];
  return <span className={cn("text-xs font-medium", p.className)}>{p.label}</span>;
}
