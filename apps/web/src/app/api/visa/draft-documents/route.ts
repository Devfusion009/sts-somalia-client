import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadVisaDocument } from "@/modules/visa/actions";

export const runtime = "nodejs";

/** Separate HTTP requests avoid the browser's serial server-action transport. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (!origin || new URL(origin).host !== host) return NextResponse.json({ error: "Invalid upload origin." }, { status: 403 });
  } catch { return NextResponse.json({ error: "Invalid upload origin." }, { status: 403 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again to upload documents." }, { status: 401 });
  try {
    const form = await request.formData();
    const result = await uploadVisaDocument(null, form);
    if (result?.error) return NextResponse.json(result, { status: 400 });
    let query = supabase.from("visa_documents").select("*")
      .eq("application_id", String(form.get("applicationId")))
      .eq("document_type", String(form.get("slotKey"))).eq("is_current", true);
    const member = form.get("memberId");
    query = member ? query.eq("member_id", String(member)) : query.is("member_id", null);
    const { data: document, error } = await query.single();
    if (error || !document) return NextResponse.json({ error: "Document status is unknown. Check the application before retrying." }, { status: 500 });
    return NextResponse.json({ error: null, document });
  } catch {
    return NextResponse.json({ error: "Upload status is unknown. Check the document before retrying." }, { status: 500 });
  }
}
