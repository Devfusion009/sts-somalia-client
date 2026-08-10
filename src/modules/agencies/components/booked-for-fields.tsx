"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <UserRound className="size-3.5" /> Agency booking
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="agencyCustomerId">Booking for</Label>
        <select
          id="agencyCustomerId"
          name="agencyCustomerId"
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
      </div>
      {selection === "new" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="newCustomerName">
              Customer name <span className="text-destructive">*</span>
            </Label>
            <Input id="newCustomerName" name="newCustomerName" placeholder="Full name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newCustomerPhone">Phone</Label>
            <Input id="newCustomerPhone" name="newCustomerPhone" placeholder="+252…" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
