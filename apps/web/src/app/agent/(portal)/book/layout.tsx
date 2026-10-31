import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { BookingContextBar } from "@/modules/agencies/components/booking-context-bar";
import { DeskSteps } from "./desk-steps";
import { Suspense } from "react";
import { ServiceTabs } from "./service-tabs";

export default async function BookingDeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customers = await getBookingCustomers(supabase, membership.agency.id);
  const available =
    Number(membership.agency.credit_balance ?? 0) + Number(membership.agency.credit_limit ?? 0);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Suspense fallback={<div className="h-13 rounded-xl bg-card" />}><ServiceTabs hasCustomer={customers.length > 0} /></Suspense>
        <DeskSteps hasCustomer={customers.length > 0} />
        {customers.length > 0 ? (
          <BookingContextBar customers={customers} available={available} />
        ) : null}
      </div>
      {children}
    </div>
  );
}
