"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { invalidateSetting } from "@/lib/site-settings";
import { SOCIAL_PLATFORM_ORDER, type SocialLink } from "@/lib/social-platforms";
import type { ActionState } from "@/lib/auth/actions";

async function saveSetting(key: string, value: unknown) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key, value: value as never, updated_by: userData.user?.id }, { onConflict: "key" });
  return error;
}

const urlSchema = z.string().url("Enter a full link starting with https://.").refine((v) => /^https:\/\//i.test(v), "Links must start with https://.");

export async function saveSocialLinks(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();

  const links: SocialLink[] = [];
  for (const platform of SOCIAL_PLATFORM_ORDER) {
    const raw = String(formData.get(platform) ?? "").trim();
    if (!raw) continue;
    const parsed = urlSchema.safeParse(raw);
    if (!parsed.success) return { error: `${platform}: ${parsed.error.issues[0].message}` };
    links.push({ platform, url: parsed.data });
  }

  const error = await saveSetting("social_links", links);
  if (error) return { error: error.message };

  await invalidateSetting("social_links");
  revalidatePath("/", "layout");
  return { error: null };
}

const bankSchema = z.object({
  bankName: z.string().trim().min(2, "Enter the bank name."),
  accountName: z.string().trim().min(2, "Enter the account name."),
  accountNumber: z.string().trim().min(4, "Enter the account number."),
});

export async function saveBankTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = bankSchema.safeParse({
    bankName: formData.get("bankName"),
    accountName: formData.get("accountName"),
    accountNumber: formData.get("accountNumber"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const error = await saveSetting("bank_transfer", parsed.data);
  if (error) return { error: error.message };

  await invalidateSetting("bank_transfer");
  revalidatePath("/admin/integrations");
  return { error: null };
}
