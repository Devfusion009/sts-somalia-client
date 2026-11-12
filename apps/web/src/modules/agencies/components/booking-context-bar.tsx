"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { AGENT_SERVICES } from "@/modules/agencies/services";
import { ChevronDown, TriangleAlert, UserRound, Users, Wallet } from "lucide-react";
import { AgentMoney } from "@/components/portal/agent-money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/money";
import { countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { passportStatus, travellerName, travellerReady } from "@/modules/agencies/traveller-profile";
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
  const incomplete = customers.filter((customer) => !travellerReady(customer)).length;

  return (
    <section aria-label="Booking customer and wallet" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-4 sm:px-5">
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
      </div>
      <TravellerManifest customers={customers} incomplete={incomplete} />
    </section>
  );
}

function day(value: string | null) {
  return value ? format(parseISO(value), "d MMM yyyy") : null;
}

function Missing() {
  return <span className="font-medium text-destructive">Missing</span>;
}

/**
 * The identity each booking is placed under, straight from the customer
 * profiles, so the agent checks names and passports here instead of
 * re-typing them on every service form.
 */
function TravellerManifest({ customers, incomplete }: { customers: BookingCustomer[]; incomplete: number }) {
  return (
    <details className="group border-t border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-sm font-semibold outline-none select-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5 [&::-webkit-details-marker]:hidden">
        Traveller details
        <Badge variant="neutral" className="tabular-nums">{customers.length}</Badge>
        {incomplete > 0 ? (
          <Badge variant="warning" className="tabular-nums"><TriangleAlert aria-hidden="true" />{incomplete} incomplete</Badge>
        ) : null}
        <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="bg-secondary text-left text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold sm:px-5">Traveller</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Gender</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Date of birth</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Nationality</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Passport</th>
              <th scope="col" className="px-4 py-2.5 font-semibold sm:px-5">Expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((customer) => {
              const status = passportStatus(customer.passport_expiry_date);
              return (
                <tr key={customer.id} className="align-top">
                  <th scope="row" className="px-4 py-3 text-left font-semibold sm:px-5">
                    <span className="block">{travellerName(customer)}</span>
                    {!travellerReady(customer) ? (
                      <Link href={`/agent/customers/${customer.id}`} className="mt-1 inline-flex items-center gap-1 rounded text-xs font-semibold text-[color-mix(in_oklch,var(--brand-gold),var(--foreground)_45%)] underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        <TriangleAlert className="size-3.5" aria-hidden="true" />Complete profile
                      </Link>
                    ) : null}
                  </th>
                  <td className="px-3 py-3 capitalize">{customer.gender ?? <Missing />}</td>
                  <td className="px-3 py-3 tabular-nums">{day(customer.date_of_birth) ?? <Missing />}</td>
                  <td className="px-3 py-3">{customer.nationality ? countryName(customer.nationality) : <Missing />}</td>
                  <td className="px-3 py-3 font-mono text-[0.8125rem] font-semibold tracking-wider">{customer.passport_number ?? <Missing />}</td>
                  <td className={cn(
                    "px-4 py-3 tabular-nums sm:px-5",
                    status === "expired" && "font-semibold text-destructive",
                    status === "expiring" && "font-semibold text-[color-mix(in_oklch,var(--brand-gold),var(--foreground)_45%)]"
                  )}>
                    {day(customer.passport_expiry_date) ?? <Missing />}
                    {status === "expired" ? " · Expired" : status === "expiring" ? " · Expires soon" : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
