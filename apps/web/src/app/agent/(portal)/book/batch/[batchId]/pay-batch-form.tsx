"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { payBatchFromWallet } from "@/modules/agencies/batch-booking-actions";

export function PayBatchForm({
  batchId,
  count,
  amountLabel,
}: {
  batchId: string;
  count: number;
  amountLabel: string;
}) {
  const [state, formAction] = useActionState(payBatchFromWallet, null);
  const submitted = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (submitted.current && state && state.error === null) {
      submitted.current = false;
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      action={(formData) => {
        submitted.current = true;
        formAction(formData);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="batchId" value={batchId} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton pendingText="Paying…">
        Pay {count} order{count === 1 ? "" : "s"} · {amountLabel}
      </SubmitButton>
    </form>
  );
}
