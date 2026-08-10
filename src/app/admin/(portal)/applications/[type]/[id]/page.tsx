import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { detailRows } from "@/lib/format-detail";
import {
  getApplicationDetail,
  getApplicationAuditTrail,
  getAdminProfiles,
  getDocumentReviews,
  type ApplicationType,
} from "@/modules/admin/queries";
import { startReview } from "@/modules/admin/application-actions";
import { getAccountIdsByApplication } from "@/modules/admin/partner-accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApplicationActions } from "../../application-actions";
import { ReviewerPicker } from "../reviewer-picker";
import { InternalNotesForm } from "../internal-notes-form";
import { DocumentReviewControls } from "../document-review-controls";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  under_review: "bg-chart-3/10 text-chart-3",
  more_info_requested: "bg-destructive/10 text-destructive",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-muted text-muted-foreground",
};

const TYPE_FROM_SLUG: Record<string, ApplicationType> = {
  agency: "agency",
  "hotel-partner": "hotel_partner",
  affiliate: "affiliate",
};

const TYPE_LABEL: Record<ApplicationType, string> = {
  agency: "Travel Agent",
  hotel_partner: "Hotel Partner",
  affiliate: "Affiliate",
};

const DOCUMENT_BUCKET = "kyc-documents";

type DocumentRef = { key: string; label: string; storage_path: string; file_name: string; uploaded_at: string };

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`border-transparent capitalize ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function DetailGrid({ rows }: { rows: Array<[string, string]> }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No details submitted yet.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium break-words">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

const businessDetailRows = detailRows;

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type: slug, id } = await params;
  const type = TYPE_FROM_SLUG[slug];
  if (!type) notFound();

  const [application, auditTrail, admins, documentReviews, accountIds] = await Promise.all([
    getApplicationDetail(type, id),
    getApplicationAuditTrail(type, id),
    getAdminProfiles(),
    getDocumentReviews(type, id),
    getAccountIdsByApplication(type, [id]),
  ]);
  if (!application) notFound();
  const partnerAccountId = accountIds.get(id);

  const name =
    type === "agency"
      ? (application as { agency_name: string }).agency_name
      : type === "hotel_partner"
        ? (application as { business_name: string }).business_name
        : `${TYPE_LABEL[type]} application`;

  const docRefs: DocumentRef[] = Array.isArray((application as { document_refs?: unknown }).document_refs)
    ? ((application as { document_refs: unknown }).document_refs as DocumentRef[])
    : [];

  const supabase = await createClient();
  const signedDocs = await Promise.all(
    docRefs.map(async (doc) => {
      const { data } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.storage_path, 3600);
      return { ...doc, url: data?.signedUrl ?? null };
    })
  );

  const applicant = application.applicant as unknown as { full_name: string | null; email: string; phone: string | null } | null;
  const reviewer = application.reviewer as unknown as { full_name: string | null; email: string } | null;
  const isActionable = application.status === "pending" || application.status === "under_review";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/admin/applications" />} className="gap-1">
        <ArrowLeft className="size-4" /> All applications
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold">{name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{application.reference_number ?? id}</span> · {TYPE_LABEL[type]} ·{" "}
            {format(new Date(application.submitted_at ?? application.created_at), "dd MMM yyyy, hh:mm a")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={application.status} />
          {application.status === "pending" ? (
            <form action={startReview.bind(null, type, id)}>
              <Button size="sm" variant="outline" type="submit">
                Start review
              </Button>
            </form>
          ) : null}
          {application.status === "approved" && partnerAccountId ? (
            <Button
              size="sm"
              render={<Link href={`/admin/partners/${slug}/${partnerAccountId}`} />}
            >
              Manage Partner Account
            </Button>
          ) : null}
        </div>
      </div>

      {application.status === "rejected" && application.review_notes ? (
        <Alert variant="destructive">
          <AlertDescription>Rejected: {application.review_notes}</AlertDescription>
        </Alert>
      ) : null}
      {application.status === "more_info_requested" && application.review_notes ? (
        <Alert>
          <AlertDescription>Requested from applicant: {application.review_notes}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Applicant</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid
                rows={[
                  ["Full Name", applicant?.full_name ?? "—"],
                  ["Email", applicant?.email ?? "—"],
                  ["Phone", applicant?.phone ?? "—"],
                ]}
              />
            </CardContent>
          </Card>

          {type !== "affiliate" || Object.keys((application as { business_details?: unknown }).business_details ?? {}).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business Details</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailGrid rows={businessDetailRows((application as { business_details?: unknown }).business_details)} />
              </CardContent>
            </Card>
          ) : null}

          {type === "affiliate" && (application as { notes?: string }).notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes from applicant</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{(application as { notes: string }).notes}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Documents ({signedDocs.length})
                {signedDocs.length > 0 ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {signedDocs.filter((d) => documentReviews.get(d.key)?.status === "verified").length} verified
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {signedDocs.map((doc) => {
                  const review = documentReviews.get(doc.key);
                  const reviewer = review?.reviewer as unknown as { full_name: string | null; email: string } | null;
                  return (
                    <div key={doc.storage_path} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{doc.label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {doc.file_name} · uploaded {format(new Date(doc.uploaded_at), "dd MMM yyyy, hh:mm a")}
                          </p>
                        </div>
                        {doc.url ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            render={<a href={doc.url} target="_blank" rel="noreferrer" />}
                            className="shrink-0 gap-1 text-primary"
                          >
                            View <ExternalLink className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                      <DocumentReviewControls
                        applicationId={application.id}
                        type={type}
                        docKey={doc.key}
                        status={(review?.status as "pending" | "verified" | "rejected" | undefined) ?? "pending"}
                        note={review?.note ?? null}
                        reviewedAt={review?.reviewed_at ?? null}
                        reviewerName={reviewer?.full_name ?? reviewer?.email ?? null}
                      />
                    </div>
                  );
                })}
                {signedDocs.length === 0 ? <p className="text-sm text-muted-foreground">No documents uploaded.</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4" /> Audit trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditTrail.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
              ) : (
                <ol className="space-y-3">
                  {auditTrail.map((event) => {
                    const actor = event.actor as unknown as { full_name: string | null; email: string } | null;
                    return (
                      <li key={event.id} className="flex items-start gap-3 text-sm">
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                        <div>
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="font-medium capitalize">{event.action}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(event.created_at), "dd MMM yyyy, hh:mm a")}
                            </span>
                            {actor ? <span className="text-xs text-muted-foreground">by {actor.full_name ?? actor.email}</span> : null}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {isActionable ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <ApplicationActions applicationId={application.id} type={type} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assigned reviewer</CardTitle>
            </CardHeader>
            <CardContent>
              <ReviewerPicker
                applicationId={application.id}
                type={type}
                currentReviewerId={application.assigned_reviewer}
                admins={admins}
              />
              {reviewer ? (
                <p className="mt-2 text-xs text-muted-foreground">Currently: {reviewer.full_name ?? reviewer.email}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Internal notes</CardTitle>
            </CardHeader>
            <CardContent>
              <InternalNotesForm applicationId={application.id} type={type} initialNotes={application.internal_notes} />
            </CardContent>
          </Card>

          {application.reviewed_at ? (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Last reviewed {format(new Date(application.reviewed_at), "dd MMM yyyy, hh:mm a")}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
