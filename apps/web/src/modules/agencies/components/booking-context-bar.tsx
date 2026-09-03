import { UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg bg-secondary/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isGroup ? <Users className="size-4" /> : <UserRound className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Booking for</p>
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
                {first.profile_id ? (
                  <Badge className="border-transparent bg-primary/10 text-primary">
                    STS account
                  </Badge>
                ) : null}
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
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Available</p>
          <p className="font-semibold tabular-nums leading-tight">
            {currency} {available.toFixed(0)}
          </p>
        </div>
        <form action={clearBookingCustomer}>
          <Button type="submit" variant="outline" size="sm">
            Change
          </Button>
        </form>
      </div>
    </div>
  );
}
