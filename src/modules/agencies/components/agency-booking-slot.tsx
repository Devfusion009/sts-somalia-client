import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveAgencyId } from "@/modules/orders/helpers";
import { getAgencyCustomers } from "@/modules/agencies/booked-for";
import { BookedForFields } from "./booked-for-fields";

/**
 * Server slot dropped into each vertical's booking form (via a
 * `bookedForSlot` prop from the page). Renders the agent-only "Booking for"
 * picker when the viewer is an active agency member, nothing otherwise —
 * so B2C visitors never see B2B chrome.
 */
export async function AgencyBookingSlot() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const agencyId = await getActiveAgencyId(supabase, profile.id);
  if (!agencyId) return null;

  const customers = await getAgencyCustomers(supabase, agencyId);
  return <BookedForFields customers={customers} />;
}
