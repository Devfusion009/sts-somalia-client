import { NextResponse } from "next/server";
import { zipSync, strToU8 } from "fflate";
import { z } from "zod";
import { requireVisaPermission } from "@/modules/visa/staff-auth";
import { getVisaCase } from "@/modules/visa/case-queries";
import { submissionBlocker, submissionDocuments, submissionEmailText } from "@/modules/visa/submission-packet";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const draft = z.object({
  officeName: z.string().trim().min(2).max(160).regex(/^[^\r\n]+$/),
  email: z.string().trim().email().max(254).regex(/^[^\r\n]+$/),
  phone: z.string().trim().min(6).max(40).regex(/^[+\d\s().-]+$/),
  subject: z.string().trim().min(1).max(300).regex(/^[^\r\n]+$/), body: z.string().trim().min(1).max(50000),
});
export async function POST(request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  await requireVisaPermission("visa.submission.record");
  const { applicationId } = await params;
  if (!z.string().uuid().safeParse(applicationId).success) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  const parsed = draft.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return NextResponse.json({ error: "Enter the office name, valid email, phone, subject and message." }, { status: 400 });
  const data = await getVisaCase(applicationId);
  if (!data) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  const blocked = submissionBlocker(data);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
  const client = await createClient();
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  let bytes = 0;
  for (const [index, doc] of submissionDocuments(data).entries()) {
    const { data: path, error } = await client.rpc("visa_log_document_access", { p_document_id: doc.id });
    if (error || !path) return NextResponse.json({ error: "A document is unavailable. Refresh the application." }, { status: 409 });
    const { data: file, error: downloadError } = await client.storage.from("visa-documents").download(path);
    if (downloadError || !file) return NextResponse.json({ error: `Could not attach ${doc.label}. No draft was generated.` }, { status: 502 });
    bytes += file.size;
    if (bytes > 12 * 1024 * 1024) return NextResponse.json({ error: "The documents exceed the 12MB email-draft limit. Arrange a secure transfer with the visa office." }, { status: 413 });
    attachments.push({ filename: `${index + 1}-${(doc.file_name ?? doc.label).replace(/[\r\n/\\]/g, "_")}`, content: Buffer.from(await file.arrayBuffer()), contentType: doc.content_type ?? file.type ?? "application/octet-stream" });
  }
  const latest = await getVisaCase(applicationId);
  if (!latest || submissionBlocker(latest) || submissionDocuments(latest).map(doc => doc.id).sort().join() !== submissionDocuments(data).map(doc => doc.id).sort().join()) return NextResponse.json({ error: "The application documents changed. Refresh before preparing the pack." }, { status: 409 });
  const text = `${parsed.data.body}\n\nVisa office: ${parsed.data.officeName}\nOffice phone: ${parsed.data.phone}`;
  const files: Record<string, Uint8Array> = {
    "application-summary.txt": strToU8(submissionEmailText(data)),
    "email-message.txt": strToU8(`To: ${parsed.data.email}\nSubject: ${parsed.data.subject}\n\n${text}`),
  };
  for (const attachment of attachments) files[`documents/${attachment.filename}`] = new Uint8Array(attachment.content);
  const bundle = zipSync(files, { level: 0 });
  return new Response(new Uint8Array(bundle), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${data.application.application_ref.replace(/[^a-zA-Z0-9-]/g, "_")}-submission.zip"`, "Cache-Control": "private, no-store" } });
}
