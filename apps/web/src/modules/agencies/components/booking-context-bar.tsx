"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { AGENT_SERVICES } from "@/modules/agencies/services";
import { UserRound, Users, Wallet } from "lucide-react";
import { AgentMoney } from "@/components/portal/agent-money";
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
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const service = AGENT_SERVICES.find((item) => pathname.split("/").includes(item.key));
  const [first] = customers;
  if (!first) return null;
  const isGroup = customers.length > 1;

  return (
    <section aria-label="Booking customer and wallet" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex min-w-0 max-w-full items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"
        >
          {isGroup ? <Users className="size-4" /> : <UserRound className="size-4" />}
        </span>
        <dl className="min-w-0 space-y-1">
          <dt className="text-xs text-muted-foreground">Booking for</dt>
          {isGroup ? (
            <>
              <dd className="font-semibold leading-tight">{customers.length} customers</dd>
              <dd className="truncate text-xs text-muted-foreground">
                {customers.map((customer) => customer.full_name).join(" · ")}
              </dd>
            </>
          ) : (
            <>
              <dd className="flex flex-wrap items-center gap-2 font-semibold leading-tight">
                {first.full_name}
                {first.profile_id ? <Badge variant="info">STS account</Badge> : null}
              </dd>
              {first.phone || first.email ? (
                <dd className="truncate text-xs text-muted-foreground">
                  {[first.phone, first.email].filter(Boolean).join(" · ")}
                </dd>
              ) : null}
            </>
          )}
        </dl>
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-border pt-3 sm:w-auto sm:gap-5 sm:border-0 sm:pt-0">
        <dl className="space-y-1">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="size-3.5" aria-hidden="true" />Available to spend</dt>
          <dd className="font-heading font-semibold tabular-nums leading-tight text-foreground">
            <AgentMoney value={money(available, currency)} />
          </dd>
        </dl>
        <div>
          <Button type="button" variant="outline" disabled={pending} loading={pending} onClick={() => startTransition(async () => {
            await clearBookingCustomer();
            router.push(service ? `/agent/book?service=${service.key}` : "/agent/book");
          })}>
            {isGroup ? "Change customers" : "Change customer"}
          </Button>
        </div>
      </div>
    </section>
  );
}
