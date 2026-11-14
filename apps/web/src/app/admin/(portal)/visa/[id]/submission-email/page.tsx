import { notFound } from "next/navigation";
import { requireVisaPermission } from "@/modules/visa/staff-auth";
import { getVisaCase } from "@/modules/visa/case-queries";
import { submissionBlocker, submissionDocuments, submissionEmailText } from "@/modules/visa/submission-packet";
import { BackLink } from "@/components/back-link";
import { EmailDraftComposer } from "./email-draft-composer";

export const metadata = { title: "Visa Office Submission" };
export default async function SubmissionEmailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireVisaPermission("visa.submission.record");
  const { id } = await params;
  const data = await getVisaCase(id);
  if (!data) notFound();
  return <div className="mx-auto max-w-5xl space-y-6">
    <BackLink href={`/admin/visa/${id}?tab=submission`} label="Back to submission" />
    <header><h1 className="font-heading text-2xl font-semibold">Prepare visa office submission</h1><div className="mt-1 font-mono text-sm text-muted-foreground">{data.application.application_ref}</div></header>
    <EmailDraftComposer applicationId={id} subject={`Visa application — ${data.application.visa_type?.name} — ${data.application.application_ref}`} body={submissionEmailText(data)} blocker={submissionBlocker(data)} documents={submissionDocuments(data).map(doc => ({ id: doc.id, name: doc.file_name ?? doc.label, label: doc.label, status: doc.review_status }))} />
  </div>;
}
