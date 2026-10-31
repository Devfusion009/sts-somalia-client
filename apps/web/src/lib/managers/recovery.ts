"use server";
import { managerIdPattern } from "./identity";
import { sendManagerResetLink } from "./credentials";
import type { ActionState } from "@/lib/auth/actions";
export async function requestManagerPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get("managerCode") ?? "").trim().toUpperCase();
  if (!managerIdPattern.test(code)) return { error: "Enter a valid manager ID." };
  await sendManagerResetLink(code);
  return { error: null };
}
