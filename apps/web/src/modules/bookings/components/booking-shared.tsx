import { Building2, Plane, FileText, Landmark, PartyPopper, type LucideIcon } from "lucide-react";
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { money } from "@/lib/money";
import type { BookingType } from "../types";

export const TYPE_ICON: Record<BookingType, LucideIcon> = {
  hotel: Building2,
  flight: Plane,
  visa: FileText,
  umrah: Landmark,
  hall: PartyPopper,
};

export const TYPE_LABEL: Record<BookingType, string> = {
  hotel: "Hotel",
  flight: "Flight",
  visa: "Visa",
  umrah: "Umrah",
  hall: "Event hall",
};

// Customer-facing overrides on the app-wide status map.
const STATUS_OVERRIDES: Partial<Record<string, BadgeVariant>> = {
  additional_info_required: "warning",
  awaiting_confirmation: "warning",
  no_show: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusBadgeVariant(status, STATUS_OVERRIDES)} className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

/** `USD 1,234.00` — same format as the consoles (lib/money). */
export function formatMoney(amount: number, currency: string) {
  return money(amount, currency);
}

export function formatDate(iso: string | null) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : "Africa/Mogadishu",
  });
}
