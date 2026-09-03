"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { initiatePayment } from "@/modules/payments/actions";

export function PayFromWalletForm({
  orderId,
  amountLabel,
}: {
  orderId: string;
  amountLabel: string;
}) {
  const [state, formAction] = useActionState(initiatePayment, null);
  const router = useRouter();

  // Settling lands back on this same page, so refresh rather than navigate.
  useEffect(() => {
    if (state?.destination) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="methodId" value="agency_wallet" />
      <input type="hidden" name="desk" value="1" />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton pendingText="Paying…">Pay {amountLabel} from agency balance</SubmitButton>
    </form>
  );
}
