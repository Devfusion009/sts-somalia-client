import { AnswerReviewProvider } from "@/modules/partner-applications/components/answer-review";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Check, FileStack, History, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/back-link";
import { createClient } from "@/lib/supabase/server";
import {
  getApplicationDetail,
  getApplicationAuditTrail,
  getDocumentReviews,
  type ApplicationType,
} from "@/modules/admin/queries";
import { startReview } from "@/modules/admin/application-actions";
import { getAccountIdsByApplication } from "@/modules/admin/partner-accounts";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { StatRail } from "@/components/dashboard/stat-rail";
import { APPLICATION_STATUS_VARIANT, applicationStatusLabel } from "../../status";
import { ApplicationActions } from "../../application-actions";
import { InternalNotesForm } from "../internal-notes-form";
import { DocumentReviewControls } from "../document-review-controls";
import {
  SectionTitle,
  BusinessDetailsCard,
  AffiliateDetailCards,
  DetailSection,
  DocFileIcon,
  detailSectionLinks,
  headerFacts,
  SECTION_TONES,
  type SectionTone,
  type Details,
} from "@/modules/partner-applications/components/detail-cards";
import { partnerLogoUrl } from "@/modules/partner-applications/logo-url";

export const metadata: Metadata = { title: "Application" };

const TYPE_FROM_SLUG: Record<string, ApplicationType> = {
  agency: "agency",
  "hotel-partner": "hotel_partner",
  affiliate: "affiliate",
  "venue-partner": "venue_partner",
};

const TYPE_LABEL: Record<ApplicationType, string> = {
  agency: "Travel agency",
  hotel_partner: "Hotel partner",
  affiliate: "Affiliate",
  venue_partner: "Venue partner",
};

const DOCUMENT_BUCKET = "kyc-documents";

type DocumentRef = { key: string; label: string; storage_path: string; file_name: string; uploaded_at: string };

/** Colour and wording per audit action: created green, updated blue, removed red, decisions by outcome. */
function auditStyle(action: string): { label: string; dot: string; pill: string } {
  const key = action.toLowerCase();
  if (key === "insert" || key.includes("submit") || key.includes("creat"))
    return { label: key === "insert" ? "Created" : action.replace(/_/g, " "), dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" };
  if (key === "delete" || key.includes("reject"))
    return { label: key === "delete" ? "Deleted" : action.replace(/_/g, " "), dot: "bg-rose-500", pill: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" };
  if (key.includes("approv") || key.includes("verif"))
    return { label: action.replace(/_/g, " "), dot: "bg-emerald-600", pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200" };
  if (key.includes("info") || key.includes("request"))
    return { label: action.replace(/_/g, " "), dot: "bg-amber-500", pill: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" };
  return { label: key === "update" ? "Updated" : action.replace(/_/g, " "), dot: "bg-blue-500", pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" };
}

/** Left edge and tint of a document row by its review status. */
const DOC_ROW_STATUS: Record<string, string> = {
  verified: "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5",
  rejected: "border-l-rose-500 bg-rose-50/50 dark:bg-rose-500/5",
  pending: "border-l-amber-400",
};

/** Compact 3-node pipeline (Submitted -> Under Review -> Decision) so the admin sees where an application sits at a glance, not just its current label. */
function ReviewPipeline({ status }: { status: string }) {
  const inReview = status !== "pending";
  const decided = status === "approved" || status === "rejected";
  const rejected = status === "rejected";
  const nodes = [
    { label: "Submitted", done: true, active: false },
    { label: "Review", done: inReview, active: status === "under_review" || status === "more_info_requested" },
    { label: "Decision", done: decided, active: false, rejected },
  ];
  return (
    <div className="flex items-center" aria-hidden="true">
      {nodes.map((node, i) => (
        <div key={node.label} className={cn("flex items-center", i < nodes.length - 1 && "flex-1")}>
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                node.rejected && node.done
                  ? "bg-destructive text-destructive-foreground"
                  : node.done
                    ? "bg-primary text-primary-foreground"
                    : node.active
                      ? "bg-primary/15 text-primary ring-2 ring-primary/40"
                      : "bg-muted text-muted-foreground"
              )}
            >
              {node.done ? (node.rejected ? <X className="size-3.5" /> : <Check className="size-3.5" />) : i + 1}
            </span>
            <span className="text-center text-xs leading-tight whitespace-nowrap text-muted-foreground">{node.label}</span>
          </div>
          {i < nodes.length - 1 ? <span className={cn("mx-1 h-px flex-1", node.done ? "bg-primary" : "bg-border")} /> : null}
        </div>
      ))}
    </div>
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type: slug, id } = await params;
  const type = TYPE_FROM_SLUG[slug];
  if (!type) notFound();

  const [application, auditTrail, documentReviews, accountIds] = await Promise.all([
    getApplicationDetail(type, id),
    getApplicationAuditTrail(type, id),
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
  const decider = application.decider as unknown as { full_name: string | null; email: string } | null;
  const details = ((application as { business_details?: unknown }).business_details ?? {}) as Details;
  const logoUrl = partnerLogoUrl(typeof details.logoPath === "string" ? details.logoPath : null);

  // The account that signed in and submitted is routinely a different person
  // from the business's authorized contact; both sit side by side in the rail.
  const verifiedDocs = signedDocs.filter((d) => documentReviews.get(d.key)?.status === "verified").length;
  const railItems: Array<{ label: string; value: string }> = [
    { label: "Submitted by", value: applicant?.full_name ?? applicant?.email ?? "—" },
    { label: "Account email", value: applicant?.email ?? "—" },
    ...(type === "affiliate"
      ? []
      : [{ label: "Authorized contact", value: String(details.contactFullName ?? "—") || "—" }]),
    { label: "Documents", value: signedDocs.length === 0 ? "None" : `${verifiedDocs} of ${signedDocs.length} verified` },
    ...(type === "agency"
      ? [
          {
            label: "Requested markup",
            value:
              details.requestedMarkupPercent == null || details.requestedMarkupPercent === ""
                ? "—"
                : `${details.requestedMarkupPercent}%`,
          },
        ]
      : []),
  ];
  const submitted = application.submitted_at ?? application.created_at;
  const meta = [
    application.reference_number ?? id,
    TYPE_LABEL[type],
    ...headerFacts(type, details),
    format(new Date(submitted), "d MMM yyyy, HH:mm"),
  ].join(" · ");
  const decided = application.status === "approved" || application.status === "rejected";
  const sections = detailSectionLinks(type);
  const jumpLinks: Array<{ id: string; label: string; tone: SectionTone }> = [
    ...sections,
    ...(type === "affiliate" && (application as { notes?: string }).notes
      ? [{ id: "notes", label: "Notes", tone: "slate" as const }]
      : []),
    { id: "documents", label: "Documents", tone: "sky" },
    { id: "audit", label: "Audit trail", tone: "slate" },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <BackLink href="/admin/applications" label="All applications" />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-center gap-4">
            {logoUrl ? (
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card max-sm:size-12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="" className="size-full object-contain" />
              </span>
            ) : null}
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{name}</h1>
                <Badge variant={APPLICATION_STATUS_VARIANT[application.status] ?? "neutral"}>
                  {applicationStatusLabel(application.status)}
                </Badge>
              </div>
              <p className="text-sm break-words text-muted-foreground tabular-nums">{meta}</p>
            </div>
          </div>
          {application.status === "approved" && partnerAccountId ? (
            <Button className="shrink-0" render={<Link href={`/admin/partners/${slug}/${partnerAccountId}`} />}>
              Partner account
            </Button>
          ) : null}
        </header>

        <StatRail className={cn(railItems.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
          {railItems.map(({ label, value }) => (
            <div key={label} className="min-w-0 bg-secondary/40 px-4 py-3">
              <dt className="truncate text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </StatRail>
      </div>

      {application.status === "rejected" && application.review_notes ? (
        <Alert variant="destructive">
          <AlertDescription>Rejected: {application.review_notes}</AlertDescription>
        </Alert>
      ) : null}
      {application.status === "more_info_requested" && application.review_notes ? (
        <Alert variant="warning">
          <AlertDescription className="whitespace-pre-wrap">Requested from applicant: {application.review_notes}</AlertDescription>
        </Alert>
      ) : null}

      <nav
        aria-label="Application sections"
        className="sticky top-14 z-10 -mx-4 overflow-x-auto border-y border-border bg-background/90 px-4 py-2 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:px-2"
      >
        <ol className="flex min-w-max items-center gap-1">
          {jumpLinks.map((link, i) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                style={{ "--tone": SECTION_TONES[link.tone] } as React.CSSProperties}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 font-heading text-sm font-semibold text-foreground/75 transition-colors hover:bg-[color-mix(in_oklab,var(--tone)_10%,transparent)] hover:text-[var(--tone)]"
              >
                <span className="flex size-5 items-center justify-center rounded-md bg-[var(--tone)] font-mono text-[10px] font-bold text-white tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {link.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <AnswerReviewProvider key={`${id}:${application.status}`} applicationId={id} type={type} enabled={application.status === "pending" || application.status === "under_review"}>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {Object.keys(details).length === 0 ? null : type === "affiliate" ? (
            <AffiliateDetailCards details={details} />
          ) : (
            <BusinessDetailsCard kind={type} details={details} />
          )}

          {type === "affiliate" && (application as { notes?: string }).notes ? (
            <DetailSection id="notes" step={sections.length + 1} title="Notes from applicant" tone="slate">
              <p className="text-sm break-words">{(application as { notes: string }).notes}</p>
            </DetailSection>
          ) : null}

          <DetailSection
            id="documents"
            step={jumpLinks.length - 1}
            title="Documents"
            tone="sky"
            meta={
              signedDocs.length > 0 ? (
                <Badge variant={verifiedDocs === signedDocs.length ? "success" : "neutral"} className="tabular-nums">
                  {verifiedDocs}/{signedDocs.length} verified
                </Badge>
              ) : null
            }
          >
              {signedDocs.length === 0 ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <FileStack />
                  </EmptyMedia>
                  <EmptyTitle>No documents</EmptyTitle>
                </Empty>
              ) : (
                <ul className="-mx-5 -my-5 divide-y divide-border sm:-mx-6">
                  {signedDocs.map((doc) => {
                    const review = documentReviews.get(doc.key);
                    const docReviewer = review?.reviewer as unknown as { full_name: string | null; email: string } | null;
                    return (
                      <li
                        key={doc.storage_path}
                        className={cn("flex gap-3 border-l-4 px-4 py-3 sm:px-6", DOC_ROW_STATUS[review?.status ?? "pending"] ?? DOC_ROW_STATUS.pending)}
                      >
                        <DocFileIcon fileName={doc.file_name} />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="min-w-0">
                            <p className="truncate font-heading text-sm font-semibold">{doc.label}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground tabular-nums">
                              {doc.file_name} · {format(new Date(doc.uploaded_at), "d MMM yyyy, HH:mm")}
                            </p>
                          </div>
                          <DocumentReviewControls
                            applicationId={application.id}
                            type={type}
                            docKey={doc.key}
                            status={(review?.status as "pending" | "verified" | "rejected" | undefined) ?? "pending"}
                            note={review?.note ?? null}
                            reviewedAt={review?.reviewed_at ?? null}
                            reviewerName={docReviewer?.full_name ?? docReviewer?.email ?? null}
                            viewUrl={doc.url}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
          </DetailSection>

          <DetailSection id="audit" title="Audit trail" tone="slate">
              {auditTrail.length === 0 ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <History />
                  </EmptyMedia>
                  <EmptyTitle>No changes recorded</EmptyTitle>
                </Empty>
              ) : (
                <ol className="max-h-80 space-y-3 overflow-y-auto pr-2">
                  {auditTrail.map((event) => {
                    const actor = event.actor as unknown as { full_name: string | null; email: string } | null;
                    return (
                      <li key={event.id} className="flex items-start gap-3 text-sm">
                        <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", auditStyle(event.action).dot)} />
                        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide uppercase",
                              auditStyle(event.action).pill
                            )}
                          >
                            {auditStyle(event.action).label}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">
                            {format(new Date(event.created_at), "d MMM yyyy, HH:mm")}
                            {actor ? ` · ${actor.full_name ?? actor.email}` : ""}
                          </span>
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
          </DetailSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-32">
          <Card>
            <CardHeader>
              <SectionTitle>Review</SectionTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ReviewPipeline status={application.status} />
              {application.status === "pending" ? (
                <div className="space-y-2">
                  <form action={startReview.bind(null, type, id)}>
                    <Button type="submit" variant="outline" className="w-full">
                      Start review
                    </Button>
                  </form>
                  <ApplicationActions applicationId={application.id} type={type} />
                </div>
              ) : application.status === "under_review" ? (
                <ApplicationActions applicationId={application.id} type={type} />
              ) : decided ? (
                <div className="border-t border-border pt-4 text-sm">
                  <p className="font-medium">
                    {application.status === "approved" ? "Approved" : "Rejected"}
                    {decider ? ` by ${decider.full_name ?? decider.email}` : ""}
                  </p>
                  {application.reviewed_at ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(application.reviewed_at), "d MMM yyyy, HH:mm")}
                    </p>
                  ) : null}
                </div>
              ) : application.reviewed_at ? (
                <p className="border-t border-border pt-4 text-xs text-muted-foreground tabular-nums">
                  Last reviewed {format(new Date(application.reviewed_at), "d MMM yyyy, HH:mm")}
                </p>
              ) : null}
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <SectionTitle>Internal notes</SectionTitle>
            </CardHeader>
            <CardContent>
              <InternalNotesForm applicationId={application.id} type={type} initialNotes={application.internal_notes} />
            </CardContent>
          </Card>
        </aside>
      </div>
      </AnswerReviewProvider>
    </div>
  );
}
