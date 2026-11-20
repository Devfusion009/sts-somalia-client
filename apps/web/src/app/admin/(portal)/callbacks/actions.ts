"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "closed"]),
});

export async function updateCallbackStatus(formData: FormData) {
  await requirePlatformAdmin();
  const parsed = updateSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) throw new Error("Invalid callback update.");
  const db = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await db.from("marketing_callback_requests")
    .update({ status: parsed.data.status }).eq("id", parsed.data.id).select("id").maybeSingle();
  if (error || !data) throw new Error("Callback status could not be saved.");
  revalidatePath("/admin/callbacks");
}
