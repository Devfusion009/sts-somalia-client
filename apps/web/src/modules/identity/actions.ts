"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const profileSchema = z.object({
  fullName: z.string().min(2, "Enter your full name."),
  phone: z.string().optional(),
  countryCode: z.string().optional(),
});

export async function updateProfileAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireUser();

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") || undefined,
    countryCode: formData.get("countryCode") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone ?? null,
      country_code: parsed.data.countryCode ?? null,
    })
    .eq("id", profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/account");
  return { error: null };
}
