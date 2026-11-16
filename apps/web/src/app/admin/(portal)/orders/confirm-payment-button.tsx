"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { ConfirmButton } from "@/components/ui/confirm-button";

/** Admin marks a manual payment (bank transfer / cash) as received. */
export function ConfirmPaymentButton({ paymentId, amount, orderNumber }: { paymentId: string; amount?: string; orderNumber?: string }) {
  const router = useRouter();
  const confirmPayment = trpc.payments.admin.confirmPayment.useMutation({
    onSuccess: () => { router.refresh(); window.location.reload(); },
  });

  return (
    <div className="space-y-1.5">
      <ConfirmButton
        size="sm"
        disabled={confirmPayment.isPending}
        loading={confirmPayment.isPending}
        title="Confirm cash received?"
        description={`Confirm ${amount ?? "the cash payment"} was collected at an STS office${orderNumber ? ` for ${orderNumber}` : ""}. This records the payment against the booking.`}
        confirmLabel="Confirm cash received"
        destructive={false}
        icon="check"
        onConfirm={() => confirmPayment.mutate({ paymentId })}
      >
        <BadgeCheck aria-hidden="true" /> Confirm cash received
      </ConfirmButton>
      {confirmPayment.error ? <p role="alert" className="text-xs text-destructive">{confirmPayment.error.message}</p> : null}
    </div>
  );
}
