"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";

/**
 * Cancels a held/unpaid order — the underlying booking and any reserved
 * inventory are released atomically by the cancel_order() DB function.
 * Confirm-gated since this can't be undone from the UI.
 */
export function CancelOrderButton({
  orderId,
  redirectTo,
  label = "Cancel Order",
}: {
  orderId: string;
  redirectTo?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const cancelOrder = trpc.orders.cancel.useMutation({
    onSuccess: () => {
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    },
  });

  async function handleSubmit(formData: FormData) {
    try {
      await cancelOrder.mutateAsync({ orderId, reason: (formData.get("reason") as string) || undefined });
    } catch {
      // handled via cancelOrder.error
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" />}>
        <X className="size-3.5" /> {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>
            This releases any reserved inventory and can&apos;t be undone. The order stays in your
            history as cancelled.
          </DialogDescription>
        </DialogHeader>
        {cancelOrder.error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{cancelOrder.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <form action={handleSubmit} className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Keep order
          </Button>
          <SubmitButton size="sm" variant="destructive" pendingText="Cancelling…">
            Yes, cancel it
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
