import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  ExternalLink,
  User,
  UserCheck,
  Mail,
  FileCheck2,
  Building2,
  BedDouble,
  PartyPopper,
  Clock,
  Search,
  MessageCircleQuestion,
  CheckCircle2,
  XCircle,
  Check,
  X,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/back-link";
import { createClient } from "@/lib/supabase/server";
import {
  getApplicationDetail,
  getApplicationAuditTrail,
  getAdminProfiles,
  getDocumentReviews,
  type ApplicationType,
} from "@/modules/admin/queries";
import { startReview } from "@/modules/admin/application-actions";
import { getAccountIdsByApplication } from "@/modules/admin/partner-accounts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ApplicationActions } from "../../application-actions";
import { ReviewerPicker } from "../reviewer-picker";
import { InternalNotesForm } from "../internal-notes-form";
import { DocumentReviewControls } from "../document-review-controls";
import {
  SectionTitle,
  BusinessDetailsCard,
  AffiliateDetailCards,
  DocFileIcon,
  type Details,
} from "@/modules/partner-applications/components/detail-cards";
import { partnerLogoUrl } from "@/modules/partner-applications/logo-url";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  under_review: "bg-chart-3/10 text-chart-3",
  more_info_requested: "bg-destructive/10 text-destructive",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-muted text-muted-foreground",
};

const STATUS_META: Record<string, { label: string; icon: LucideIcon }> = {
  pending: { label: "Pending Review", icon: Clock },
  under_review: { label: "Under Review", icon: Search },
  more_info_requested: { label: "Awaiting Applicant", icon: MessageCircleQuestion },
  approved: { label: "Approved", icon: CheckCircle2 },
  rejected: { label: "Rejected", icon: XCircle },
};

const TYPE_FROM_SLUG: Record<string, ApplicationType> = {
  agency: "agency",
  "hotel-partner": "hotel_partner",
  affiliate: "affiliate",
  "venue-partner": "venue_partner",
};

const TYPE_LABEL: Record<ApplicationType, string> = {
  agency: "Travel Agent",
  hotel_partner: "Hotel Partner",
  affiliate: "Affiliate",
  venue_partner: "Venue Partner",
};

const TYPE_ICON: Record<ApplicationType, LucideIcon> = {
  agency: Building2,
  hotel_partner: BedDouble,
  venue_partner: PartyPopper,
  affiliate: User,
};

const DOCUMENT_BUCKET = "kyc-documents";

type DocumentRef = { key: string; label: string; storage_path: string; file_name: string; uploaded_at: string };

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status];
  const Icon = meta?.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {meta?.label ?? status.replace(/_/g, " ")}
    </span>
  );
}

/** Compact 3-node pipeline (Submitted -> Under Review -> Decision) so the admin sees where an application sits at a glance, not just its current label. */
function ReviewPipeline({ status }: { status: string }) {
  const inReview = status !== "pending";
  const decided = status === "approved" || status === "rejected";
  const rejected = status === "rejected";
  const nodes = [
    { label: "Submitted", done: true, active: false },
    { label: "Under Review", done: inReview, active: status === "under_review" || status === "more_info_requested" },
    { label: "Decision", done: decided, active: false, rejected },
  ];
  return (
    <div className="flex items-center">
      {nodes.map((node, i) => (
        <div key={node.label} className={cn("flex items-center", i < nodes.length - 1 && "flex-1")}>
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
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
            <span className="text-center text-[10px] leading-tight whitespace-nowrap text-muted-foreground">{node.label}</span>
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
  const TypeIcon = TYPE_ICON[type];
  const details = ((application as { business_details?: unknown }).business_details ?? {}) as Details;
  const logoUrl = partnerLogoUrl(typeof details.logoPath === "string" ? details.logoPath : null);

  // The account that signed in and submitted is routinely a different person
  // from the business's authorized contact — showing only the former under a
  // bare "Applicant" heading made admins think the contact they'd entered had
  // been lost. Both sit side by side here.
  const verifiedDocs = signedDocs.filter((d) => documentReviews.get(d.key)?.status === "verified").length;
  const railItems: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: User, label: "Submitted by", value: applicant?.full_name ?? applicant?.email ?? "—" },
    { icon: Mail, label: "Account email", value: applicant?.email ?? "—" },
    ...(type === "affiliate"
      ? []
      : [{ icon: UserCheck, label: "Authorized contact", value: String(details.contactFullName ?? "—") || "—" }]),
    { icon: FileCheck2, label: "Documents", value: signedDocs.length === 0 ? "None" : `${verifiedDocs}/${signedDocs.length} verified` },
    ...(type === "agency"
      ? [
          {
            icon: Percent,
            label: "Requested markup",
            value:
              details.requestedMarkupPercent == null || details.requestedMarkupPercent === ""
                ? "—"
                : `${details.requestedMarkupPercent}%`,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <BackLink href="/admin/applications" label="Back to all applications" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className="size-full object-contain" />
            </span>
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TypeIcon className="size-5" />
            </span>
          )}
          <div>
            <h1 className="font-heading text-xl font-semibold">{name}</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{application.reference_number ?? id}</span> · {TYPE_LABEL[type]} ·{" "}
              {format(new Date(application.submitted_at ?? application.created_at), "dd MMM yyyy, hh:mm a")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={application.status} />
          {application.status === "approved" && partnerAccountId ? (
            <Button size="sm" render={<Link href={`/admin/partners/${slug}/${partnerAccountId}`} />}>
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

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl bg-secondary/40 px-4 py-4 lg:grid-cols-4">
        {railItems.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex min-w-0 items-start gap-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
              <dd className="truncate text-sm font-semibold text-foreground">{value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {Object.keys(details).length === 0 ? null : type === "affiliate" ? (
            <AffiliateDetailCards details={details} elevated />
          ) : (
            <BusinessDetailsCard kind={type} details={details} elevated />
          )}

          {type === "affiliate" && (application as { notes?: string }).notes ? (
            <Card className="shadow-sm">
              <CardHeader>
                <SectionTitle>Notes from applicant</SectionTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{(application as { notes: string }).notes}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-sm">
            <CardHeader>
              <SectionTitle>
                <span>
                  Documents ({signedDocs.length})
                  {signedDocs.length > 0 ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {signedDocs.filter((d) => documentReviews.get(d.key)?.status === "verified").length} verified
                    </span>
                  ) : null}
                </span>
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {signedDocs.map((doc) => {
                  const review = documentReviews.get(doc.key);
                  const reviewer = review?.reviewer as unknown as { full_name: string | null; email: string } | null;
                  return (
                    <div key={doc.storage_path} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <DocFileIcon fileName={doc.file_name} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.label}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {doc.file_name} · uploaded {format(new Date(doc.uploaded_at), "dd MMM yyyy, hh:mm a")}
                            </p>
                          </div>
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

          <Card className="shadow-sm">
            <CardHeader>
              <SectionTitle>Audit trail</SectionTitle>
            </CardHeader>
            <CardContent>
              {auditTrail.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
              ) : (
                <ol className="max-h-80 space-y-3 overflow-y-auto pr-2">
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
          <Card className="shadow-sm">
            <CardHeader>
              <SectionTitle>Application Review</SectionTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReviewPipeline status={application.status} />
              <Separator />
              {application.status === "pending" ? (
                <div className="space-y-3">
                  <form action={startReview.bind(null, type, id)}>
                    <Button type="submit" variant="outline" className="w-full gap-1.5">
                      <Search className="size-4" /> Start Review
                    </Button>
                  </form>
                  <ApplicationActions applicationId={application.id} type={type} />
                </div>
              ) : application.status === "under_review" ? (
                <ApplicationActions applicationId={application.id} type={type} />
              ) : application.status === "more_info_requested" ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageCircleQuestion className="size-4 shrink-0 text-destructive" /> Waiting on the applicant to respond.
                </p>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  {application.status === "approved" ? (
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">
                      {application.status === "approved" ? "Approved" : "Rejected"}
                      {reviewer ? ` by ${reviewer.full_name ?? reviewer.email}` : ""}
                    </p>
                    {application.reviewed_at ? (
                      <p className="text-xs text-muted-foreground">{format(new Date(application.reviewed_at), "dd MMM yyyy, hh:mm a")}</p>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <SectionTitle>Assigned reviewer</SectionTitle>
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

          <Card className="shadow-sm">
            <CardHeader>
              <SectionTitle>Internal notes</SectionTitle>
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
