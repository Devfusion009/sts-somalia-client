import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { updateCallbackStatus } from "./actions";

export const metadata: Metadata = { title: "Callback requests" };

export default async function CallbackRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePlatformAdmin();
  const page = parsePage((await searchParams).page);
  const size = 50;
  const db = (await createClient()) as unknown as SupabaseClient;
  const { data, count, error } = await db.from("marketing_callback_requests")
    .select("id,name,phone,service,message,status,created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  if (error) throw new Error("Callback requests could not be loaded.");
  return <div className="space-y-5">
    <PageHeader title="Callback requests" />
    <Card className="overflow-hidden py-0">
      {!data?.length ? <p className="p-6">No callback requests</p> : <ul className="divide-y">{data.map(row => <li key={row.id} className="grid gap-2 p-5 md:grid-cols-[1fr_1fr_1fr_auto]">
        <div><strong>{row.name}</strong><div className="text-sm text-muted-foreground">{row.service}</div></div>
        <a href={`tel:${row.phone}`} className="font-medium text-primary">{row.phone}</a>
        <p className="whitespace-pre-wrap text-sm">{row.message || "—"}</p>
        <div className="text-sm"><form action={updateCallbackStatus} className="flex gap-2"><input type="hidden" name="id" value={row.id} /><select name="status" defaultValue={row.status} aria-label={`Status for ${row.name}`} className="rounded-md border px-2 py-1"><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select><button type="submit" className="rounded-md border px-2 py-1 font-medium">Save</button></form><time className="mt-2 block text-muted-foreground" dateTime={row.created_at}>{new Date(row.created_at).toLocaleString("en-GB", { timeZone: "Africa/Mogadishu" })}</time></div>
      </li>)}</ul>}
    </Card>
    <Pager page={page} total={count ?? 0} pageSize={size} hrefFor={(next) => `/admin/callbacks?page=${next}`} />
  </div>;
}
