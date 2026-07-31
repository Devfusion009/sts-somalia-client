"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { createUmrahDeparture } from "@/lib/actions/admin";

export function DeparturesForm({ packageId }: { packageId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(createUmrahDeparture, null);

  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-4 sm:items-end">
      <input type="hidden" name="packageId" value={packageId} />
      {state?.error ? (
        <Alert variant="destructive" className="sm:col-span-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="departureDate">Departure date</Label>
        <Input id="departureDate" name="departureDate" type="date" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="returnDate">Return date</Label>
        <Input id="returnDate" name="returnDate" type="date" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="totalSeats">Total seats</Label>
        <Input id="totalSeats" name="totalSeats" type="number" min={1} defaultValue={40} required />
      </div>
      <SubmitButton pendingText="Adding…">
        <Plus /> Add departure
      </SubmitButton>
    </form>
  );
}
