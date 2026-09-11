"use client";

import { useActionState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { startDeskVisaApplication } from "@/modules/visa/actions";

/** Starts a desk visa application, then navigates to its wizard — a plain
 * assignment rather than router.push(), same reasoning as every other desk
 * flow's destination-in-state pattern (see advanceWizard() in actions.ts). */
export function StartApplicationButton({
  visaTypeId,
  agencyCustomerId,
}: {
  visaTypeId: string;
  agencyCustomerId: string;
}) {
  const [state, formAction] = useActionState(startDeskVisaApplication, null);

  useEffect(() => {
    if (state?.destination) window.location.href = state.destination;
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="visaTypeId" value={visaTypeId} />
      <input type="hidden" name="agencyCustomerId" value={agencyCustomerId} />
      {state?.error ? (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton size="sm" pendingText="Starting…" className="gap-1.5">
        Start application <ArrowRight className="size-3.5" />
      </SubmitButton>
    </form>
  );
}
