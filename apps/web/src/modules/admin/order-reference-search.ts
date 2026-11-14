import "server-only";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_PAGE_SIZE, pageRange } from "@/lib/pagination";

/** Search all orders, rather than filtering only the current page. */
export async function findOrderReferences(reference: string, page: number) {
  await requirePlatformAdmin();
  const term=reference.trim().replace(/[^a-zA-Z0-9-]/g,"").slice(0,80);
  if (!term) return { ids: [] as string[], total: 0 };
  const { from }=pageRange(page);
  const { data, count, error }=await (await createClient()).from("orders")
    .select("id",{count:"exact"}).ilike("order_number",`%${term}%`)
    .order("created_at",{ascending:false}).order("id",{ascending:false}).range(from,from+ADMIN_PAGE_SIZE-1);
  if(error)throw new Error("Order search is unavailable. Please try again.");
  return {ids:(data??[]).map(o=>o.id),total:count??0};
}
