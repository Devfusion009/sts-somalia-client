"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpcForActions, trpcErrorMessage } from "@/lib/trpc/server";
import { getActiveAgencyId } from "@/modules/orders/helpers";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import type { ActionState } from "@/lib/auth/actions";
import { parsePoolRequestForm } from "./pool-request-form";
export async function submitPoolRequestForm(_previous: ActionState, form: FormData): Promise<ActionState> {
  const profile = await requireUser();
  const client = await createClient();
  const agencyId = await getActiveAgencyId(client, profile.id);
  try {
    const customers = agencyId ? await getBookingCustomers(client, agencyId) : [];
    if (agencyId && !customers.length) return { error: "Select an agency customer." };
    const input = parsePoolRequestForm(form, customers.map(c => c.id));
    const results = await (await getServerTrpcForActions()).umrah.poolRequests.submit.mutate(input);
    revalidatePath("/admin/umrah/pool", "layout"); revalidatePath("/umrah", "layout");
    return { error: null, destination: `${agencyId ? "/agent" : "/account"}/umrah/requests/${results[0].id}` };
  } catch (error) { return { error: trpcErrorMessage(error, "Places could not be requested.") }; }
}
