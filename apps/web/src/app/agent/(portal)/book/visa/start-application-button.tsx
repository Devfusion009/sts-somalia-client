"use client";

import { useActionState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { FieldError } from "@/components/ui/field";
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
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="visaTypeId" value={visaTypeId} />
      <input type="hidden" name="agencyCustomerId" value={agencyCustomerId} />
      <FieldError>{state?.error}</FieldError>
      <SubmitButton variant="outline" pendingText="Starting…" className="w-full">
        Start application <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </SubmitButton>
    </form>
  );
}
