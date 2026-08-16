import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ChevronRight, Home, ArrowLeft, CheckCircle2, XCircle, FileCheck2, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { APP_CONFIG, docSlotsFor, type ApplicationKind } from "@/modules/partner-applications/config";
import { getOwnedApplication, type DocumentRef } from "@/modules/partner-applications/queries";
import { detailRows } from "@/lib/format-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Application Details" };

const DOCUMENT_BUCKET = "kyc-documents";

function isKind(value: string): value is ApplicationKind {
  return value === "agency" || value === "hotel_partner" || value === "affiliate" || value === "venue_partner";
}

const STATUS_META: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  approved: { label: "Approved", className: "bg-primary/10 text-primary", icon: CheckCircle2 },
  rejected: { label: "Not approved", className: "bg-destructive/10 text-destructive", icon: XCircle },
};

function DetailGrid({ rows }: { rows: Array<[string, string]> }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No details submitted.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium break-words">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ApplicationViewPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if (!isKind(type)) notFound();

  const user = await requireUser();
  const application = await getOwnedApplication(type, id, user.id);
  if (!application) notFound();

  const cfg = APP_CONFIG[type];
  const meta = STATUS_META[application.status] ?? { label: application.status, className: "bg-muted text-muted-foreground", icon: FileCheck2 };
  const d = application.business_details;
  const refs = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  const slotLabels = new Map(docSlotsFor(type).map((s) => [s.key, s.label]));

  const supabase = await createClient();
  const signedDocs = await Promise.all(
    refs.map(async (doc) => {
      const { data } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.storage_path, 3600);
      return { ...doc, url: data?.signedUrl ?? null };
    })
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/account/become" className="hover:text-foreground">
          Become a Partner
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">{cfg.label} Application</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{cfg.label} Application</h1>
          <p className="text-sm text-muted-foreground">
            {application.reference_number ? <span className="font-mono">{application.reference_number}</span> : null}
            {application.submitted_at ? ` · Submitted ${format(new Date(application.submitted_at), "dd MMM yyyy")}` : null}
          </p>
        </div>
        <Badge className={`gap-1.5 border-transparent ${meta.className}`}>
          <meta.icon className="size-3.5" /> {meta.label}
        </Badge>
      </div>

      {application.status === "rejected" && application.review_notes ? (
        <Alert variant="destructive" className="mb-6">
          <XCircle />
          <AlertTitle>Not approved</AlertTitle>
          <AlertDescription>{application.review_notes}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid rows={detailRows(d)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents ({signedDocs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {signedDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents were uploaded.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {signedDocs.map((doc) => (
                  <div key={doc.storage_path} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{slotLabels.get(doc.key) ?? doc.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{doc.file_name}</p>
                    </div>
                    {doc.url ? (
                      <Button size="sm" variant="ghost" render={<a href={doc.url} target="_blank" rel="noreferrer" />} className="shrink-0 gap-1 text-primary">
                        View <ExternalLink className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" className="mt-6 gap-1.5" render={<Link href="/account/become" />}>
        <ArrowLeft className="size-3.5" /> Back to Become a Partner
      </Button>
    </div>
  );
}
