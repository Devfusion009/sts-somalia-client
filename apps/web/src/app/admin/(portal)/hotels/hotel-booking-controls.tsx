"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateHotelBookingPrice } from "@/modules/admin/actions";

export function HotelBookingPriceForm({ bookingId, price, currency }: { bookingId: string; price: number; currency: string }) {
  const [state, formAction] = useActionState(updateHotelBookingPrice, null);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="bookingId" value={bookingId} />
      <span className="text-xs text-muted-foreground">{currency}</span>
      <Input name="price" type="number" min={0} step="0.01" defaultValue={price} className="h-7 w-24 text-sm" />
      <Button size="sm" variant="outline" type="submit">
        Set
      </Button>
      {state?.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
