"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

/**
 * Agent decides to pay now for a held booking — flips it into normal
 * checkout. Errors are swallowed deliberately here too (matches the
 * original Server Action's comment): the checkout page re-derives its view
 * from the order's true status regardless, via router.refresh() re-running
 * this same page's SSR data fetch. Kept as a form (not a plain onClick) so
 * SubmitButton's useFormStatus()-based pending state still works, same
 * reasoning as every other converted mutation this migration.
 */
export function ConvertHoldButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const convert = trpc.orders.convertHoldToCheckout.useMutation({
    onSuccess: () => router.refresh(),
  });

  async function handleSubmit() {
    try {
      await convert.mutateAsync({ orderId });
    } catch {
      // handled via convert.error
    }
  }

  return (
    <form action={handleSubmit}>
      {convert.error ? (
        <Alert variant="destructive" className="mb-2">
          <AlertCircle />
          <AlertDescription>{convert.error.message}</AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton size="sm" className="gap-1.5" pendingText="Processing…">
        Pay Now
      </SubmitButton>
    </form>
  );
}
