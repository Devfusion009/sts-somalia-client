"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FieldError } from "@/components/ui/field";
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

      <FieldError>{state?.error}</FieldError>

      <SubmitButton size="lg" pendingText="Paying…" className="w-full tabular-nums">
        Pay {count} order{count === 1 ? "" : "s"} · {amountLabel}
      </SubmitButton>
    </form>
  );
}
