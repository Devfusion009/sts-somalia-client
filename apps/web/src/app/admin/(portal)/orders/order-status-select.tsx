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

  const [value, setValue] = useState<OrderStatus>(status);
  const [asking, setAsking] = useState<OrderStatus | null>(null);

  // The server-side status moves on its own (a confirmed payment, a refund,
  // a cancellation elsewhere on the page); follow it after each refresh
  // instead of keeping the value this select was first rendered with.
  const [syncedStatus, setSyncedStatus] = useState(status);
  if (status !== syncedStatus) {
    setSyncedStatus(status);
    setValue(status);
  }

  // A refused change snaps the select back to the saved status.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.error) setValue(status);
  }

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

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
          {STATUSES.filter(s => s === status || !["paid", "partially_paid", "refunded"].includes(s)).map((s) => (
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
