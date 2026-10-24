"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";

/** Admin marks a manual payment (bank transfer / cash) as received. */
export function ConfirmPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const confirmPayment = trpc.payments.admin.confirmPayment.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <Button
      size="sm"
      type="button"
      loading={confirmPayment.isPending}
      onClick={() => confirmPayment.mutate({ paymentId })}
    >
      {confirmPayment.isPending ? null : <BadgeCheck aria-hidden="true" />}
      Confirm funds received
    </Button>
  );
}
