import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { BookingContextBar } from "@/modules/agencies/components/booking-context-bar";
import { DeskSteps } from "./desk-steps";
import { Suspense } from "react";
import { ServiceTabs } from "./service-tabs";
import { BookingContextVisibility } from "./booking-context-visibility";

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
        <Suspense fallback={<div className="h-24 rounded-xl bg-card" />}><DeskSteps /></Suspense>
        <ServiceTabs hasCustomer={customers.length > 0} />
        {customers.length > 0 ? (
          <BookingContextVisibility><BookingContextBar customers={customers} available={available} /></BookingContextVisibility>
        ) : null}
      </div>
      {children}
    </div>
  );
}
