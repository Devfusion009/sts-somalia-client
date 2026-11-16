import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveAgencyId } from "@/modules/orders/helpers";
import { getAgencyCustomers } from "@/modules/agencies/booked-for";
import { getBookingCustomer } from "@/modules/agencies/booking-context";
import { BookedForFields } from "./booked-for-fields";

/**
 * Server slot dropped into each vertical's booking form (via a
 * `bookedForSlot` prop from the page). Renders the agent-only "Booking for"
 * picker when the viewer is an active agency member, nothing otherwise —
 * so B2C visitors never see B2B chrome.
 */
export async function AgencyBookingSlot() {
  const agencyId = await viewerAgencyId();
  if (!agencyId) return null;

  const supabase = await createClient();

  const [customers, selectedCustomer] = await Promise.all([
    getAgencyCustomers(supabase, agencyId),
    getBookingCustomer(supabase, agencyId),
  ]);
  return <BookedForFields key={selectedCustomer?.id ?? "self"} customers={customers} initialCustomerId={selectedCustomer?.id} />;
}

/**
 * The viewer's active agency, or null for B2C visitors. Pages pass the slot
 * only when this is set: a form's `bookedForSlot ? … : null` check sees a
 * React element (always truthy) even when the slot itself renders nothing,
 * which showed agency-only controls such as "Hold" to B2C customers.
 */
export async function viewerAgencyId(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  return getActiveAgencyId(supabase, profile.id);
}
