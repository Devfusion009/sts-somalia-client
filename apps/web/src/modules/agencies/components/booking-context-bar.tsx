import { UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/money";
import { clearBookingCustomer } from "@/modules/agencies/booking-context-actions";
import type { BookingCustomer } from "@/modules/agencies/booking-context";

/**
 * Who the counter is serving, pinned above every step of the desk. The
 * wallet figure sits here because an agent quoting a walk-in needs to know
 * what they can still spend before they start searching, not at checkout.
 */
export function BookingContextBar({
  customers,
  available,
  currency = "USD",
}: {
  customers: BookingCustomer[];
  available: number;
  currency?: string;
}) {
  const [first] = customers;
  const isGroup = customers.length > 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl bg-secondary/40 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-foreground ring-1 ring-foreground/10"
        >
          {isGroup ? <Users className="size-4" /> : <UserRound className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Booking for</p>
          {isGroup ? (
            <>
              <p className="font-medium leading-tight">{customers.length} customers</p>
              <p className="truncate text-xs text-muted-foreground">
                {customers.map((customer) => customer.full_name).join(" · ")}
              </p>
            </>
          ) : (
            <>
              <p className="flex flex-wrap items-center gap-2 font-medium leading-tight">
                {first.full_name}
                {first.profile_id ? <Badge variant="info">STS account</Badge> : null}
              </p>
              {first.phone || first.email ? (
                <p className="truncate text-xs text-muted-foreground">
                  {[first.phone, first.email].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="font-heading font-semibold tabular-nums leading-tight">
            {money(available, currency)}
          </p>
        </div>
        <form action={clearBookingCustomer}>
          <Button type="submit" variant="outline">
            Change
          </Button>
        </form>
      </div>
    </div>
  );
}
