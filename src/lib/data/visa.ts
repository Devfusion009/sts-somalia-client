import "server-only";
import { createClient } from "@/lib/supabase/server";
import { countryName } from "@/lib/countries";

export async function getVisaTypes(filters: { country?: string } = {}) {
  const supabase = await createClient();
  const { data } = await supabase.from("visa_types").select("*").eq("status", "published").order("name");
  const visaTypes = data ?? [];

  if (!filters.country) return visaTypes;

  const needle = filters.country.trim().toLowerCase();
  return visaTypes.filter(
    (v) =>
      v.destination_country_code.toLowerCase().includes(needle) ||
      countryName(v.destination_country_code).toLowerCase().includes(needle)
  );
}

export async function getVisaTypeById(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visa_types")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  return data;
}
