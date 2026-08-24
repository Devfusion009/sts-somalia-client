import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck2,
  ExternalLink,
  Building2,
  BedDouble,
  PartyPopper,
  User,
  Star,
  Hash,
  Tag,
  CalendarDays,
  Send,
  Search,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResubmitDocumentForm } from "@/modules/partner-applications/components/resubmit-document-form";

export const metadata: Metadata = { title: "Application Details" };

const DOCUMENT_BUCKET = "kyc-documents";

function isKind(value: string): value is ApplicationKind {
  return value === "agency" || value === "hotel_partner" || value === "affiliate" || value === "venue_partner";
}

// Same wording as the Recent Applications table on /account/become — this
// page is reachable straight from that row, and two names for one state reads
// as two different states.
const STATUS_META: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  approved: { label: "Approved", className: "bg-primary/10 text-primary", icon: CheckCircle2 },
  rejected: { label: "Not approved", className: "bg-destructive/10 text-destructive", icon: XCircle },
  pending: { label: "Submitted", className: "bg-brand-gold/15 text-brand-gold", icon: Clock },
  under_review: { label: "Under review", className: "bg-chart-3/10 text-chart-3", icon: Clock },
  more_info_requested: { label: "Action needed", className: "bg-destructive/10 text-destructive", icon: XCircle },
};

// Matches the icon each program uses on the admin side of this same record —
// a partner comparing notes with staff sees the same visual identity.
const TYPE_ICON: Record<ApplicationKind, LucideIcon> = {
  agency: Building2,
  hotel_partner: BedDouble,
  venue_partner: PartyPopper,
  affiliate: User,
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
        <Star key={i} className={cn("size-3.5", i < value ? "fill-brand-gold text-brand-gold" : "fill-none text-muted-foreground/25")} />
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
  const meta = STATUS_META[application.status] ?? { label: application.status, className: "bg-muted text-muted-foreground", icon: FileCheck2 };
  const d = (application.business_details ?? {}) as Details;
  const refs = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  const slotLabels = new Map(docSlotsFor(type).map((s) => [s.key, s.label]));

  const nameValue = cfg.nameField ? ((application as unknown as Record<string, unknown>)[cfg.nameField] as string | null) : null;
  const displayName = nameValue || `${cfg.label} Application`;
  const TypeIcon = TYPE_ICON[type];
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

  const railItems: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: Hash, label: "Reference", value: application.reference_number ?? "—" },
    { icon: Tag, label: "Program", value: cfg.label },
    { icon: CalendarDays, label: "Submitted", value: application.submitted_at ? format(new Date(application.submitted_at), "dd MMM yyyy") : "—" },
    { icon: FileCheck2, label: "Documents", value: signedDocs.length === 0 ? "None" : `${verifiedCount}/${signedDocs.length} verified` },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/account/become"
        aria-label="Back to Become a Partner"
        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
      </Link>

      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <TypeIcon className="size-6" />
            </span>
            <div>
              <h1 className="font-heading text-2xl font-semibold">{displayName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{cfg.label}</span>
                {facts.map((fact) => (
                  <span key={fact} className="before:mr-2 before:content-['·']">
                    {fact}
                  </span>
                ))}
                {stars ? (
                  <span className="before:mr-2 before:content-['·']">
                    <StarRow value={stars} />
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <Badge className={`gap-1.5 border-transparent ${meta.className}`}>
            <meta.icon className="size-3.5" /> {meta.label}
          </Badge>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <SectionTitle>Application progress</SectionTitle>
        </CardHeader>
        <CardContent>
          <StatusTimeline stages={APPLICATION_STAGES} currentIndex={stage.index} outcome={stage.outcome} />
        </CardContent>
      </Card>

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

      {application.status === "rejected" && application.review_notes ? (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Not approved</AlertTitle>
          <AlertDescription>{application.review_notes}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6">
        {type === "affiliate" ? (
          <AffiliateDetailCards details={d} elevated />
        ) : (
          <BusinessDetailsCard kind={type} details={d} elevated />
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <SectionTitle>
              Documents ({signedDocs.length})
              {signedDocs.length > 0 ? <span className="ml-2 text-xs font-normal text-muted-foreground">{verifiedCount} verified</span> : null}
            </SectionTitle>
          </CardHeader>
          <CardContent>
            {signedDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents were uploaded.</p>
            ) : (
              <div className="space-y-3">
                {signedDocs.map((doc) => {
                  const review = reviews[doc.key];
                  return (
                    <div key={doc.storage_path} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <DocFileIcon fileName={doc.file_name} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{slotLabels.get(doc.key) ?? doc.label}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {doc.file_name} · uploaded {format(new Date(doc.uploaded_at), "dd MMM yyyy")}
                            </p>
                          </div>
                        </div>
                        {doc.url ? (
                          <Button size="sm" variant="ghost" render={<a href={doc.url} target="_blank" rel="noreferrer" />} className="shrink-0 gap-1 text-primary">
                            View <ExternalLink className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                      {review?.status === "rejected" ? (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                            <XCircle className="size-3.5" /> Rejected
                          </p>
                          {review.note ? <p className="mt-0.5 text-xs text-muted-foreground">{review.note}</p> : null}
                          <ResubmitDocumentForm kind={type} applicationId={id} docKey={doc.key} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
