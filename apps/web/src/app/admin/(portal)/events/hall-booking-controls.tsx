"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateHallBookingStatus, updateHallBookingPrice } from "@/modules/admin/actions";
import type { Database } from "@/lib/types/database.types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

const STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "refunded",
  "no_show",
];

export function HallBookingStatusSelect({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [state, formAction] = useActionState(updateHallBookingStatus, null);
  const [value, setValue] = useState<BookingStatus>(status);

  return (
    <form action={formAction} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="status" value={value} />
      <Select value={value} onValueChange={(v) => setValue(v as BookingStatus)}>
        <SelectTrigger size="sm" className="w-[130px] capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {s.replace("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" type="submit" disabled={value === status}>
        Save
      </Button>
      {state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}

export function HallBookingPriceForm({
  bookingId,
  price,
  currency,
}: {
  bookingId: string;
  price: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(updateHallBookingPrice, null);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="bookingId" value={bookingId} />
      <span className="text-xs text-muted-foreground">{currency}</span>
      <Input
        name="price"
        type="number"
        min={0}
        step="0.01"
        defaultValue={price}
        className="h-7 w-24 text-sm"
      />
      <Button size="sm" variant="outline" type="submit">
        Set
      </Button>
      {state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
