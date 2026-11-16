import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ proofId: string }> }) {
  const { proofId } = await params;
  if (!z.string().uuid().safeParse(proofId).success) return new NextResponse("Not found", { status: 404 });
  const client = await createClient() as unknown as SupabaseClient;
  // Both the row and private bucket enforce access through the parent order.
  const { data } = await client.from("payment_proofs").select("storage_path").eq("id", proofId).maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });
  const { data: signed } = await client.storage.from("payment-proofs").createSignedUrl(data.storage_path, 60);
  if (!signed) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
