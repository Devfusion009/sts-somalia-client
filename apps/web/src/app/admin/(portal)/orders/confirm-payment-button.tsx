"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { ConfirmButton } from "@/components/ui/confirm-button";

/** Admin marks a manual payment (bank transfer / cash) as received. */
export function ConfirmPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const confirmPayment = trpc.payments.admin.confirmPayment.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="space-y-1.5">
      <ConfirmButton
        size="sm"
        disabled={confirmPayment.isPending}
        loading={confirmPayment.isPending}
        title="Approve this payment?"
        description="Confirm that the funds have been received. Approval records this payment against the booking."
        confirmLabel="Approve payment"
        destructive={false}
        icon="check"
        onConfirm={() => confirmPayment.mutate({ paymentId })}
      >
        <BadgeCheck aria-hidden="true" /> Approve payment
      </ConfirmButton>
      {confirmPayment.error ? <p role="alert" className="text-xs text-destructive">{confirmPayment.error.message}</p> : null}
    </div>
  );
}
