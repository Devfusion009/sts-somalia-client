"use client";

import { useActionState, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateBookingStatus } from "@/lib/actions/hotel-partner";

const OPTIONS = ["pending", "confirmed", "cancelled", "completed", "no_show"] as const;

export function BookingStatusControl({ bookingId, status }: { bookingId: string; status: string }) {
  const [, formAction] = useActionState(updateBookingStatus, null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={formAction} ref={formRef}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <Select
        name="status"
        defaultValue={status}
        onValueChange={() => {
          requestAnimationFrame(() => formRef.current?.requestSubmit());
        }}
      >
        <SelectTrigger size="sm" className="w-36 capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt} className="capitalize">
              {opt.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
