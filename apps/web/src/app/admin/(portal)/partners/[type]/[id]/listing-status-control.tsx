"use client";

import { useActionState } from "react";
import { adminSetHotelStatus, adminSetRoomStatus } from "@/modules/admin/actions";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "published", label: "Published — live & bookable" },
  { value: "suspended", label: "Suspended" },
];

/**
 * Admin-only status control for a partner-submitted hotel or room —
 * publishing (making it real, bookable-by-customers inventory) is
 * deliberately not something the partner form can do; this is the only
 * place that transition happens. Same auto-submit-on-change pattern as
 * ReviewerPicker elsewhere in this console.
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
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
