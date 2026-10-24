"use client";

import { useState } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export type BookedForCustomer = { id: string; full_name: string; phone: string | null };

/**
 * Agent-only "Booking for" block rendered inside every vertical's booking
 * form. Submits `agencyCustomerId` ("self" | customer id | "new") plus
 * inline `newCustomerName`/`newCustomerPhone` when creating a client-book
 * entry on the fly — resolved server-side by resolveBookedForCustomer().
 * Native <select> on purpose: it's inside a dialog on every vertical, and
 * the Base UI Select trigger/label pitfalls aren't worth it for this.
 */
export function BookedForFields({ customers }: { customers: BookedForCustomer[] }) {
  const [selection, setSelection] = useState("self");

  return (
    <div role="group" aria-labelledby="agency-booking-heading" className="space-y-3 rounded-xl bg-secondary/40 p-4">
      <p id="agency-booking-heading" className="text-sm font-semibold">
        Agency booking
      </p>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="agencyCustomerId">Booking for</FieldLabel>
          <select
            id="agencyCustomerId"
            name="agencyCustomerId"
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="self">Myself / walk-in</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.phone ? ` — ${c.phone}` : ""}
              </option>
            ))}
            <option value="new">+ New customer…</option>
          </select>
        </Field>
        {selection === "new" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="newCustomerName">
                Customer name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="newCustomerName" name="newCustomerName" placeholder="Full name" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="newCustomerPhone">Phone</FieldLabel>
              <Input id="newCustomerPhone" name="newCustomerPhone" type="tel" placeholder="+252…" />
            </Field>
          </div>
        ) : null}
      </FieldGroup>
    </div>
  );
}
