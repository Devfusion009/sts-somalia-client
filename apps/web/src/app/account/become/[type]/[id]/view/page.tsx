import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { CheckCircle2, ExternalLink, FileText, Search, Send, Star, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/back-link";
import { APP_CONFIG, docSlotsFor, type ApplicationKind } from "@/modules/partner-applications/config";
import { getOwnedApplication, getDocumentReviews, type DocumentRef } from "@/modules/partner-applications/queries";
import {
  SectionTitle,
  BusinessDetailsCard,
  AffiliateDetailCards,
  DocFileIcon,
  headerFacts,
  starRatingValue,
  type Details,
} from "@/modules/partner-applications/components/detail-cards";
import { StatusTimeline, type TimelineStage } from "@/modules/bookings/components/status-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResubmitDocumentForm } from "@/modules/partner-applications/components/resubmit-document-form";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Application Details" };

const DOCUMENT_BUCKET = "kyc-documents";

function isKind(value: string): value is ApplicationKind {
  return value === "agency" || value === "hotel_partner" || value === "affiliate" || value === "venue_partner";
}

// Same wording as the Recent Applications table on /account/become — this
// page is reachable straight from that row, and two names for one state reads
// as two different states.
const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Not approved", variant: "neutral" },
  pending: { label: "Submitted", variant: "warning" },
  under_review: { label: "Under review", variant: "info" },
  more_info_requested: { label: "Action needed", variant: "destructive" },
};

// The application's actual lifecycle, not a decorative sequence: every row in
// application_status lands on one of these three stops. more_info_requested
// stays parked at "Under review" rather than getting its own marker — the
// ball is back with the applicant, but the process hasn't moved to a new
// stage, and the status badge above already says a document needs attention.
const APPLICATION_STAGES: TimelineStage[] = [
  { key: "submitted", label: "Submitted", icon: Send },
  { key: "under_review", label: "Under review", icon: Search },
  { key: "decision", label: "Decision", icon: CheckCircle2 },
];

function applicationStageIndex(status: string): { index: number; outcome: "pending" | "success" | "failed" } {
  switch (status) {
    case "under_review":
    case "more_info_requested":
      return { index: 1, outcome: "pending" };
    case "approved":
      return { index: 2, outcome: "success" };
    case "rejected":
      return { index: 2, outcome: "failed" };
    default:
      return { index: 0, outcome: "pending" };
  }
}

function StarRow({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={cn("size-3.5", i < value ? "fill-brand-gold text-brand-gold" : "fill-none text-muted-foreground/25")}
        />
      ))}
    </span>
  );
}

export default async function ApplicationViewPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if (!isKind(type)) notFound();

  const user = await requireUser();
  const application = await getOwnedApplication(type, id, user.id);
  if (!application) notFound();

  const cfg = APP_CONFIG[type];
  const meta = STATUS_META[application.status] ?? { label: application.status, variant: "neutral" as const };
  const d = (application.business_details ?? {}) as Details;
  const refs = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  const slotLabels = new Map(docSlotsFor(type).map((s) => [s.key, s.label]));

  const nameValue = cfg.nameField ? ((application as unknown as Record<string, unknown>)[cfg.nameField] as string | null) : null;
  const displayName = nameValue || `${cfg.label} Application`;
  const facts = headerFacts(type, d);
  const stars = type === "hotel_partner" ? starRatingValue(d) : null;
  const stage = applicationStageIndex(application.status);

  const supabase = await createClient();
  const [signedDocs, reviews] = await Promise.all([
    Promise.all(
      refs.map(async (doc) => {
        const { data } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.storage_path, 3600);
        return { ...doc, url: data?.signedUrl ?? null };
      })
    ),
    getDocumentReviews(type, id),
  ]);
  const verifiedCount = refs.filter((doc) => reviews[doc.key]?.status === "verified").length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <BackLink href="/account/become" label="Back to Become a Partner" />

      <PageHeader
        title={displayName}
        status={<Badge variant={meta.variant}>{meta.label}</Badge>}
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{cfg.label}</span>
            {facts.map((fact) => (
              <span key={fact} className="before:mr-2 before:content-['·']">
                {fact}
              </span>
            ))}
            {stars ? (
              <span className="inline-flex items-center before:mr-2 before:content-['·']">
                <StarRow value={stars} />
              </span>
            ) : null}
          </span>
        }
      />

      <StatRail>
        <StatRailItem label="Reference" value={<span className="font-mono text-base">{application.reference_number ?? "—"}</span>} />
        <StatRailItem label="Program" value={cfg.label} />
        <StatRailItem
          label="Submitted"
          value={application.submitted_at ? format(new Date(application.submitted_at), "d MMM yyyy") : "—"}
        />
        <StatRailItem
          label="Documents"
          value={signedDocs.length === 0 ? "None" : `${verifiedCount}/${signedDocs.length} verified`}
        />
      </StatRail>

      {application.status === "rejected" && application.review_notes ? (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Message from STS</AlertTitle>
          <AlertDescription>{application.review_notes}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusTimeline stages={APPLICATION_STAGES} currentIndex={stage.index} outcome={stage.outcome} />
        </CardContent>
      </Card>

      {type === "affiliate" ? (
        <AffiliateDetailCards details={d} elevated />
      ) : (
        <BusinessDetailsCard kind={type} details={d} elevated />
      )}

      <Card>
        <CardHeader>
          <SectionTitle>
            Documents
            {signedDocs.length > 0 ? (
              <Badge variant="secondary" className="ml-2 align-middle">
                {signedDocs.length}
              </Badge>
            ) : null}
          </SectionTitle>
        </CardHeader>
        <CardContent className="px-0">
          {signedDocs.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>No documents</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {signedDocs.map((doc) => {
                const review = reviews[doc.key];
                const label = slotLabels.get(doc.key) ?? doc.label;
                return (
                  <li key={doc.storage_path} className="space-y-3 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <DocFileIcon fileName={doc.file_name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{label}</p>
                        <p className="truncate text-sm text-muted-foreground tabular-nums">
                          {doc.file_name} · {format(new Date(doc.uploaded_at), "d MMM yyyy")}
                        </p>
                      </div>
                      {review?.status === "rejected" ? (
                        <Badge variant="destructive">Rejected</Badge>
                      ) : review?.status === "verified" ? (
                        <Badge variant="success">Verified</Badge>
                      ) : null}
                      {doc.url ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Open ${label}`}
                          title="Open"
                          render={<a href={doc.url} target="_blank" rel="noreferrer" />}
                        >
                          <ExternalLink />
                        </Button>
                      ) : null}
                    </div>
                    {review?.status === "rejected" ? (
                      <div className="space-y-2 sm:pl-11">
                        {review.note ? <p className="text-sm text-destructive">{review.note}</p> : null}
                        <ResubmitDocumentForm kind={type} applicationId={id} docKey={doc.key} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
