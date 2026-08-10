"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { getActiveAgencyId } from "@/modules/orders/helpers";

const customerSchema = z.object({
  fullName: z.string().min(2, "Enter the customer's full name."),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function createAgencyCustomer(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireUser();
  const supabase = await createClient();

  const agencyId = await getActiveAgencyId(supabase, profile.id);
  if (!agencyId) {
    return { error: "You are not an active member of an agency." };
  }

  const parsed = customerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase.from("agency_customers").insert({
    agency_id: agencyId,
    full_name: parsed.data.fullName,
    email: parsed.data.email || null,
    phone: parsed.data.phone ?? null,
    notes: parsed.data.notes ?? null,
    created_by: profile.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/agent/customers");
  return { error: null };
}
