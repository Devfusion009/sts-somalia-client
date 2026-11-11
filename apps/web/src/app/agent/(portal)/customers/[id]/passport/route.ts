import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership || membership.agency.status !== "active") return new NextResponse("Access denied.", { status: 403 });
  const { id } = await params;
  const db = await createClient();
  const { data: customer } = await db.from("agency_customers").select("passport_file_path")
    .eq("id", id).eq("agency_id", membership.agency.id).maybeSingle();
  const path = customer?.passport_file_path;
  if (!path || !path.startsWith(`${membership.agency.id}/`)) return new NextResponse("Document not found.", { status: 404 });
  const { data, error } = await db.storage.from("customer-documents").createSignedUrl(path, 60);
  if (error || !data) return new NextResponse("Document unavailable.", { status: 404 });
  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
