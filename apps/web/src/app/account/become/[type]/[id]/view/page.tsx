import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, BadgeCheck, CheckCircle2, ExternalLink, FileText, KeyRound, Search, Send, Star, XCircle } from "lucide-react";
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
import { portalHref, type PortalSubdomain } from "@/lib/subdomain";

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

const PORTAL: Record<ApplicationKind, { label: string; subdomain: PortalSubdomain }> = {
  agency: { label: "Agent Portal", subdomain: "agent" },
  hotel_partner: { label: "Hotel Partner Portal", subdomain: "partner" },
  affiliate: { label: "Affiliate Dashboard", subdomain: "affiliate" },
  venue_partner: { label: "Venue Portal", subdomain: "venue" },
};

function day(iso: string | null): string | undefined {
  return iso ? format(new Date(iso), "d MMM yyyy") : undefined;
}

/**
 * The application's lifecycle as milestones. Every status lands on one stop:
 *
 *   Submitted -> Under review -> Decision                (pending / rejected)
 *   Submitted -> Under review -> Approved -> Portal ready (approved)
 *
 * Approval adds the last milestone: the partner account exists and the
 * portal can be opened. more_info_requested stays at "Under review": the
 * ball is back with the applicant, but the process has not moved on, and the
 * status badge already says something needs attention.
 */
function applicationMilestones(
  application: { status: string; submitted_at: string | null; reviewed_at: string | null },
  portalLabel: string
): { stages: TimelineStage[]; index: number; outcome: "pending" | "success" | "failed" } {
  const submitted = { key: "submitted", label: "Submitted", description: day(application.submitted_at), icon: Send };
  const review = { key: "under_review", label: "Under review", icon: Search };

  switch (application.status) {
    case "approved":
      return {
        stages: [
          submitted,
          review,
          { key: "approved", label: "Approved", description: day(application.reviewed_at), icon: BadgeCheck },
          { key: "portal", label: "Portal ready", description: portalLabel, icon: KeyRound },
        ],
        index: 3,
        outcome: "success",
      };
    case "rejected":
      return {
        stages: [submitted, review, { key: "decision", label: "Not approved", description: day(application.reviewed_at), icon: XCircle }],
        index: 2,
        outcome: "failed",
      };
    case "under_review":
    case "more_info_requested":
      return { stages: [submitted, review, { key: "decision", label: "Decision", icon: CheckCircle2 }], index: 1, outcome: "pending" };
    default:
      return { stages: [submitted, review, { key: "decision", label: "Decision", icon: CheckCircle2 }], index: 0, outcome: "pending" };
  }
}

async function agentLoginFor(applicationId: string): Promise<{ agentId: string; contactEmail: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_agent_application_login", { p_application_id: applicationId });
  return data?.[0] ? { agentId: data[0].agent_id, contactEmail: data[0].contact_email } : null;
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
  const portal = PORTAL[type];
  const milestones = applicationMilestones(application, portal.label);
  const approved = application.status === "approved";
  const agentLogin = approved && type === "agency"
    ? (await agentLoginFor(id)) ?? (user.agent_code ? { agentId: user.agent_code, contactEmail: user.email ?? "" } : null)
    : null;

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

      {approved ? (
        <section
          aria-labelledby="portal-ready-title"
          className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-500/30 dark:bg-emerald-500/10"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
              <BadgeCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="portal-ready-title" className="font-heading text-base font-bold text-emerald-900 dark:text-emerald-100">
                Approved · {portal.label} ready
              </h2>
              {agentLogin ? (
                <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <div className="flex gap-1.5">
                    <dt className="text-emerald-800/70 dark:text-emerald-200/70">Agent ID</dt>
                    <dd className="font-mono font-semibold text-emerald-950 dark:text-emerald-50">{agentLogin.agentId}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-emerald-800/70 dark:text-emerald-200/70">Credential email</dt>
                    <dd className="font-mono font-semibold text-emerald-950 dark:text-emerald-50">{agentLogin.contactEmail}</dd>
                  </div>
                </dl>
              ) : application.reviewed_at ? (
                <p className="mt-0.5 text-sm text-emerald-800/80 tabular-nums dark:text-emerald-200/80">
                  {format(new Date(application.reviewed_at), "d MMM yyyy")}
                </p>
              ) : null}
            </div>
          </div>
          <Button className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700" render={<a href={portalHref(portal.subdomain)} />}>
            Open {portal.label} <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusTimeline stages={milestones.stages} currentIndex={milestones.index} outcome={milestones.outcome} />
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
