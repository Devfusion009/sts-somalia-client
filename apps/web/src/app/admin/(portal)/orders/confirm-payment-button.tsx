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
      className="h-7 gap-1"
      disabled={confirmPayment.isPending}
      onClick={() => confirmPayment.mutate({ paymentId })}
    >
      <BadgeCheck className="size-3.5" />
      Confirm funds received
    </Button>
  );
}
