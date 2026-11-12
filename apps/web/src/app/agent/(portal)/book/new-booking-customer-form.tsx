"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { CUSTOMER_SECTIONS, CustomerProfileFields } from "@/modules/agencies/components/customer-profile-fields";
import { createBookingCustomer } from "@/modules/agencies/booking-context-actions";
import profileStyles from "@/modules/agencies/components/customer-profile.module.css";

const LAST = CUSTOMER_SECTIONS.length - 1;

/** Registration one section at a time; every section stays mounted so one submit carries the whole profile. */
export function NewBookingCustomerForm({ redirectTo, cancelHref }: { redirectTo: string; cancelHref: string }) {
  const [state, action, pending] = useActionState(createBookingCustomer, null);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.error === null) router.push(redirectTo);
  }, [state, redirectTo, router]);

  /** Native validation for the visible section only; the browser shows the message on the first invalid field. */
  function sectionValid(index: number) {
    const section = formRef.current?.querySelector<HTMLFieldSetElement>(`[data-step="${index}"]`);
    if (!section) return true;
    for (const control of section.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return false;
      }
    }
    return true;
  }

  function goTo(next: number) {
    if (next === step || next < 0 || next > LAST) return;
    if (next > step && !sectionValid(step)) return;
    setDirection(next > step ? "forward" : "back");
    setStep(next);
    setReached((current) => Math.max(current, next));
    const top = formRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) formRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>(`[data-step="${next}"] input:not([type="hidden"]), [data-step="${next}"] select`)?.focus({ preventScroll: true });
    });
  }

  return (
    <form ref={formRef} onSubmit={(event) => {
      event.preventDefault();
      if (pending) return;
      if (step < LAST) {
        goTo(step + 1);
        return;
      }
      if (!sectionValid(step)) return;
      const data = new FormData(event.currentTarget);
      // Preserve entered details and the passport file after validation errors.
      startTransition(() => action(data));
    }} className="scroll-mt-4 space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <fieldset disabled={pending} className="min-w-0">
        <legend className="mb-3 flex w-full items-center justify-between gap-3 font-heading text-lg font-semibold">
          New customer profile
          <span className="rounded-full bg-accent px-2.5 py-1 font-sans text-xs font-semibold text-accent-foreground tabular-nums">Step {step + 1} of {LAST + 1}</span>
        </legend>
        <div className={`${profileStyles.stepProgress} mb-6`} aria-hidden="true">
          <span style={{ width: `${((step + 1) / (LAST + 1)) * 100}%` }} />
        </div>
        <CustomerProfileFields withNotes stepped={{ step, reached, direction, onStepSelect: goTo }} />
      </fieldset>
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <FieldError role="alert">{state?.error}</FieldError>
        <div className="ml-auto flex items-center gap-3">
          {step === 0
            ? <Button variant="outline" disabled={pending} render={<Link href={cancelHref} />}>Back</Button>
            : <Button type="button" variant="outline" disabled={pending} onClick={() => goTo(step - 1)}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button>}
          {step < LAST ? (
            <Button key="next" type="submit" disabled={pending}>
              Continue to {CUSTOMER_SECTIONS[step + 1].toLowerCase()}<ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button key="save" type="submit" disabled={pending} loading={pending}>
              {pending ? "Saving…" : "Save customer & continue"}<Check className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
