"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { CustomerProfileFields } from "@/modules/agencies/components/customer-profile-fields";
import { createBookingCustomer } from "@/modules/agencies/booking-context-actions";

export function NewBookingCustomerForm({ redirectTo, cancelHref }: { redirectTo: string; cancelHref: string }) {
  const [state, action, pending] = useActionState(createBookingCustomer, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.error === null) router.push(redirectTo);
  }, [state, redirectTo, router]);

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      // Preserve entered details and the passport file after validation errors.
      startTransition(() => action(data));
    }} className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <fieldset disabled={pending} className="min-w-0">
        <legend className="mb-5 font-heading text-lg font-semibold">New customer profile</legend>
        <CustomerProfileFields withNotes />
      </fieldset>
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <FieldError role="alert">{state?.error}</FieldError>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" disabled={pending} render={<Link href={cancelHref} />}>Back</Button>
          <Button type="submit" disabled={pending} loading={pending}>{pending ? "Saving…" : "Save customer & continue"}<ArrowRight className="size-4" aria-hidden="true" /></Button>
        </div>
      </div>
    </form>
  );
}
