import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Authorise, audit, then redirect to a 60-second signed URL. Staff opens are
 * logged by visa_log_document_access(); applicants and their agency get the
 * same short-lived link without a log entry. Links are never rendered into
 * pages, so a copied URL expires with the session that asked for it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  if (!z.string().uuid().safeParse(documentId).success) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("visa_log_document_access", { p_document_id: documentId });
  if (error || !path) return new NextResponse("Not found", { status: 404 });

  const { data: signed } = await supabase.storage.from("visa-documents").createSignedUrl(path, 60);
  if (!signed?.signedUrl) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
