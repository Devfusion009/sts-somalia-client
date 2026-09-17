"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";

/** Customer abandons a pending manual payment (bank transfer / cash) to pick another method. */
export function CancelPendingPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const cancelPending = trpc.payments.cancelPending.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={cancelPending.isPending}
      onClick={() => cancelPending.mutate({ paymentId })}
    >
      {cancelPending.isPending ? "Cancelling…" : "Choose a different method"}
    </Button>
  );
}
