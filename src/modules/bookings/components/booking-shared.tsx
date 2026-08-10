import { Building2, Plane, FileText, Landmark, PartyPopper, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  confirmed: "default",
  completed: "default",
  approved: "default",
  issued: "default",
  paid: "default",
  pending: "secondary",
  pending_payment: "secondary",
  processing: "secondary",
  submitted: "secondary",
  in_review: "secondary",
  additional_info_required: "secondary",
  draft: "secondary",
  held: "secondary",
  refunded: "secondary",
  cancelled: "destructive",
  rejected: "destructive",
  failed: "destructive",
  no_show: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "secondary"} className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function formatMoney(amount: number, currency: string) {
  // Intl throws on a malformed currency code, and a bad row in the database
  // must not take the whole bookings page down with it.
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(iso: string | null) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
