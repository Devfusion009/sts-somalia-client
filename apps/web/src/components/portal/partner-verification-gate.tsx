import { CheckCircle2, Circle, Clock3, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
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
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <PageHeader
        title="Verification in progress"
        meta={<span className="font-mono">{referenceNumber}</span>}
        back={{ href: "/account", label: "My account" }}
      />

      <Card>
        <CardContent className="space-y-4">
          <Progress
            value={Math.round((stagesDone / stages.length) * 100)}
            aria-label={`Verification ${stagesDone} of ${stages.length} done`}
          />
          <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {stages.map((stage) => (
              <li key={stage.label} className="flex items-center gap-2 text-sm">
                {stage.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className={cn("tabular-nums", stage.done && "text-muted-foreground line-through")}>
                  {stage.label}
                  <span className="sr-only">{stage.done ? " (done)" : " (to do)"}</span>
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
          {rejected.length > 0 ? (
            <CardAction>
              <Badge variant="destructive" className="tabular-nums">
                {rejected.length} rejected
              </Badge>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {slots.map((slot) => {
              const doc = uploaded.get(slot.key);
              const review = docReviews.get(slot.key);
              const status = review?.status ?? "pending";

              return (
                <li key={slot.key} className="space-y-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{slot.label}</p>
                      {doc ? <p className="truncate text-xs text-muted-foreground">{doc.file_name}</p> : null}
                    </div>
                    <DocStatusBadge status={status} />
                  </div>

                  {status === "rejected" ? (
                    <div className="space-y-2">
                      {review?.note ? <p className="text-sm text-destructive">{review.note}</p> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <Badge variant="success">
        <CheckCircle2 aria-hidden="true" /> Verified
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="destructive">
        <XCircle aria-hidden="true" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="neutral">
      <Clock3 aria-hidden="true" /> Awaiting review
    </Badge>
  );
}
