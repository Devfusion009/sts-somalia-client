"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateOrderStatus } from "@/modules/admin/actions";
import type { Database } from "@/lib/types/database.types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const STATUSES: OrderStatus[] = ["pending_payment", "paid", "processing", "completed", "cancelled", "refunded"];

export function OrderStatusSelect({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [state, formAction, isPending] = useActionState(updateOrderStatus, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <Select
      defaultValue={status}
      disabled={isPending}
      onValueChange={(value) => {
        if (!value) return;
        const formData = new FormData();
        formData.set("orderId", orderId);
        formData.set("status", value);
        formAction(formData);
      }}
    >
      <SelectTrigger size="sm" className="w-[150px] capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="capitalize">
            {s.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
