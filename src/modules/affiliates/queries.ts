import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getMyAffiliate(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("affiliates").select("*").eq("profile_id", profileId).maybeSingle();
  return data;
}

export async function getMyLinks(affiliateId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("affiliate_links")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getMyConversions(affiliateId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("affiliate_conversions")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getMyPayouts(affiliateId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_payouts")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
