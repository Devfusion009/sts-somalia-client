"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

/**
 * Cancels a held/unpaid order — the underlying booking and any reserved
 * inventory are released atomically by the cancel_order() DB function.
 * Confirm-gated since this can't be undone from the UI.
 */
export function CancelOrderButton({
  orderId,
  redirectTo,
  label = "Cancel Order",
  size = "sm",
  variant = "outline",
  className,
}: {
  orderId: string;
  redirectTo?: string;
  label?: string;
  /** Trigger size; "default" when it sits among page-header actions. */
  size?: "sm" | "default";
  variant?: "outline" | "ghost";
  className?: string;
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
      <DialogTrigger render={<Button variant={variant} size={size} className={cn(variant === "ghost" ? "text-muted-foreground hover:text-destructive" : "text-destructive hover:text-destructive", className)} />}>
        <X data-icon="inline-start" aria-hidden="true" /> {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>Reserved inventory is released. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <FieldError>{cancelOrder.error?.message}</FieldError>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Keep order
            </Button>
            <SubmitButton variant="destructive" pendingText="Cancelling…">
              Cancel order
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
