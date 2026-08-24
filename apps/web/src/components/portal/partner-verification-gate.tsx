import Link from "next/link";
import { CheckCircle2, Circle, Clock3, XCircle, FileText, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ResubmitDocumentForm } from "@/modules/partner-applications/components/resubmit-document-form";
import { docSlotsFor, type ApplicationKind } from "@/modules/partner-applications/config";
import type { DocumentRef } from "@/modules/admin/partner-accounts";
import { cn } from "@/lib/utils";

type Review = { status: string; note: string | null };

/**
 * The three stages are the partner's own journey, not the admin checklist —
 * the two remaining checklist items ("first property listed", "rooms
 * configured") are things they do *inside* the portal, so gating access on
 * those would deadlock. Verification is the gate; setup continues past it
 * under OnboardingStatusBanner.
 */
export function PartnerVerificationGate({
  kind,
  portalLabel,
  applicationId,
  referenceNumber,
  documentRefs,
  docReviews,
}: {
  kind: ApplicationKind;
  portalLabel: string;
  applicationId: string;
  referenceNumber: string;
  documentRefs: DocumentRef[];
  docReviews: Map<string, Review>;
}) {
  const slots = docSlotsFor(kind).filter((s) => !s.optional);
  const uploaded = new Map(documentRefs.map((d) => [d.key, d]));
  const verifiedCount = slots.filter((s) => docReviews.get(s.key)?.status === "verified").length;
  const rejected = slots.filter((s) => docReviews.get(s.key)?.status === "rejected");

  const stages = [
    { label: "Application submitted", done: true },
    { label: "Approved by STS", done: true },
    { label: `Documents verified (${verifiedCount}/${slots.length})`, done: verifiedCount === slots.length },
    { label: `${portalLabel} unlocked`, done: false },
  ];
  const stagesDone = stages.filter((s) => s.done).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="font-heading text-xl font-semibold">Verification in progress</h1>
          <p className="font-mono text-sm text-muted-foreground">{referenceNumber}</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-4 py-5">
          <Progress value={Math.round((stagesDone / stages.length) * 100)} />
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {stages.map((stage) => (
              <li key={stage.label} className="flex items-center gap-2 text-sm">
                {stage.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={cn(stage.done && "text-muted-foreground line-through")}>{stage.label}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Documents
            {rejected.length > 0 ? (
              <span className="ml-2 text-xs font-normal text-destructive">
                {rejected.length} need{rejected.length === 1 ? "s" : ""} a new upload
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {slots.map((slot) => {
            const doc = uploaded.get(slot.key);
            const review = docReviews.get(slot.key);
            const status = review?.status ?? "pending";

            return (
              <div key={slot.key} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{slot.label}</p>
                      {doc ? <p className="truncate text-xs text-muted-foreground">{doc.file_name}</p> : null}
                    </div>
                  </div>
                  <DocStatusBadge status={status} />
                </div>

                {status === "rejected" ? (
                  <div className="mt-2 border-t border-border pt-2">
                    {review?.note ? <p className="text-xs text-destructive">{review.note}</p> : null}
                    <ResubmitDocumentForm kind={kind} applicationId={applicationId} docKey={slot.key} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <Link href="/account" className="text-sm text-muted-foreground hover:text-foreground">
          Back to your account
        </Link>
      </div>
    </div>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const meta =
    status === "verified"
      ? { label: "Verified", className: "bg-primary/10 text-primary", Icon: CheckCircle2 }
      : status === "rejected"
        ? { label: "Rejected", className: "bg-destructive/10 text-destructive", Icon: XCircle }
        : { label: "Awaiting review", className: "bg-muted text-muted-foreground", Icon: Clock3 };

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        meta.className
      )}
    >
      <meta.Icon className="size-3" /> {meta.label}
    </span>
  );
}
