"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";

const linkSchema = z.object({
  campaignName: z.string().optional(),
  targetPath: z
    .string()
    .min(1, "Enter a destination path.")
    .refine((v) => v.startsWith("/"), "Path must start with /"),
});

function randomCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function createAffiliateLink(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  // Checked via direct membership lookup below, not profile.role — see the
  // same note in src/lib/actions/hotel-partner.ts.
  const profile = await requireUser();

  const parsed = linkSchema.safeParse({
    campaignName: formData.get("campaignName") || undefined,
    targetPath: formData.get("targetPath") || "/",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!affiliate) {
    return { error: "No affiliate account found for your profile." };
  }

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("affiliate_links").insert({
      affiliate_id: affiliate.id,
      campaign_name: parsed.data.campaignName ?? null,
      target_path: parsed.data.targetPath,
      code: randomCode(),
    });

    if (!error) {
      revalidatePath("/affiliate/links");
      return { error: null };
    }

    // Unique-constraint conflict on `code` — retry with a fresh random code.
    if (error.code === "23505") {
      lastError = error.message;
      continue;
    }

    return { error: error.message };
  }

  return { error: lastError ?? "Could not generate a unique link code, try again." };
}
