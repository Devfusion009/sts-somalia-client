"use client";

import { useActionState } from "react";
import { adminSetHotelStatus, adminSetRoomStatus } from "@/modules/admin/actions";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "published", label: "Published" },
  { value: "suspended", label: "Suspended" },
];

/**
 * Admin-only status control for a partner-submitted hotel or room —
 * publishing (making it real, bookable-by-customers inventory) is
 * deliberately not something the partner form can do; this is the only
 * place that transition happens. Submits as soon as the value changes.
 */
export function ListingStatusControl({
  kind,
  id,
  currentStatus,
}: {
  kind: "hotel" | "room";
  id: string;
  currentStatus: string;
}) {
  const action = kind === "hotel" ? adminSetHotelStatus : adminSetRoomStatus;
  const [, formAction] = useActionState(action, null);
  const idField = kind === "hotel" ? "hotelId" : "roomId";

  return (
    <form action={formAction}>
      <input type="hidden" name={idField} value={id} />
      <select
        key={currentStatus}
        name="status"
        aria-label={kind === "hotel" ? "Property status" : "Room status"}
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 min-w-0 rounded-lg border border-input bg-card px-2.5 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:h-10 dark:bg-input/30"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </form>
  );
}
