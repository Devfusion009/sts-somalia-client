import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Verify2faForm } from "./verify-2fa-form";

export const metadata: Metadata = { title: "Two-factor verification" };

export default async function Verify2faPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // Nothing pending (no factor enrolled, or already at aal2) — nowhere to send
  // them but onward.
  if (!aal || aal.currentLevel === aal.nextLevel) {
    redirect(redirect_to || "/account");
  }

  return <Verify2faForm redirectTo={redirect_to} />;
}
