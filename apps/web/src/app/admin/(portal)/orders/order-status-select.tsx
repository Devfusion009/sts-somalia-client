"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-button";
import { updateOrderStatus } from "@/modules/admin/actions";
import type { Database } from "@/lib/types/database.types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const STATUSES: OrderStatus[] = [
  "pending_payment",
  "partially_paid",
  "paid",
  "processing",
  "completed",
  "cancelled",
  "refunded",
];

export function OrderStatusSelect({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [state, formAction, isPending] = useActionState(updateOrderStatus, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  const [value, setValue] = useState<OrderStatus>(status);
  const [asking, setAsking] = useState<OrderStatus | null>(null);

  function commit(next: OrderStatus) {
    setValue(next);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("status", next);
    startTransition(() => formAction(formData));
  }

  return (
    <>
      <Select
        value={value}
        disabled={isPending}
        onValueChange={(next) => {
          if (!next || next === value) return;
          if (next === "cancelled" || next === "refunded") setAsking(next as OrderStatus);
          else commit(next as OrderStatus);
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
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title={asking === "refunded" ? "Mark this order as refunded?" : "Cancel this order?"}
        confirmLabel={asking === "refunded" ? "Mark refunded" : "Cancel order"}
        icon="ban"
        onConfirm={() => {
          if (asking) commit(asking);
          setAsking(null);
        }}
      />
    </>
  );
}
