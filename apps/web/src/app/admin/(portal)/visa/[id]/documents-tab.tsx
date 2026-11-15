import { ExternalLink, FileStack } from "lucide-react";
import Link from "next/link";
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResolveRequestControls } from "./resolve-request-controls";
import { DocumentStatusBadge } from "@/modules/visa/components/visa-shared";
import type { VisaCase } from "@/modules/visa/case-queries";
import { DocumentReviewControls } from "./document-review-controls";
import { RequestDocumentDialog } from "./visa-controls";
import { SectionHeading, formatBytes, formatDay, formatWhen } from "./case-ui";
import { CaseActions } from "./case-actions";
import type { VisaAction } from "@/modules/visa/workflow";

type Slot = VisaCase["documentSlots"][number];
type Doc = Slot["versions"][number];

function ViewButton({ doc }: { doc: Doc }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Open version ${doc.version}`}
      title="Open"
      render={<a href={`/api/visa/documents/${doc.id}`} target="_blank" rel="noopener noreferrer" />}
    >
      <ExternalLink />
    </Button>
  );
}

function SlotRow({ slot, applicationId, reviewable }: { slot: Slot; applicationId: string; reviewable: boolean }) {
  const current = slot.versions.find((v) => v.is_current) ?? null;
  const older = slot.versions.filter((v) => v.id !== current?.id);

  return (
    <li className="space-y-2 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-medium">
            {slot.label}
            {slot.required ? (
              <span className="text-destructive" aria-label="required">
                *
              </span>
            ) : null}
          </p>
          {current ? (
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              v{current.version} · {current.file_name ?? "file"}
              {formatBytes(current.file_size) ? ` · ${formatBytes(current.file_size)}` : ""} · {formatWhen(current.created_at)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {slot.staff ? null : (
            <DocumentStatusBadge status={current ? current.review_status : "missing"} className="mr-1" />
          )}
          {current ? <ViewButton doc={current} /> : null}
          {current && reviewable && !slot.staff && current.review_status !== "rejected" ? (
            <DocumentReviewControls
              documentId={current.id}
              applicationId={applicationId}
              reviewStatus={current.review_status}
              label={slot.label}
              fileName={current.file_name ?? undefined}
              fileSizeLabel={formatBytes(current.file_size) || undefined}
              checklist={slot.checklist}
            />
          ) : null}
        </div>
      </div>

      {current?.review_status === "rejected" && current.rejection_reason ? (
        <p className="text-xs text-destructive">{current.rejection_reason}</p>
      ) : null}

      {older.length > 0 ? (
        <details className="group text-xs">
          <summary className="w-fit cursor-pointer rounded-sm text-muted-foreground outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            {older.length} earlier {older.length === 1 ? "version" : "versions"}
          </summary>
          <ul className="mt-2 divide-y divide-border rounded-lg bg-secondary/40 px-3">
            {older.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 py-2">
                <span className="w-7 font-mono text-muted-foreground">v{doc.version}</span>
                <span className="min-w-0 flex-1 truncate tabular-nums">
                  {doc.file_name ?? "file"} · {formatWhen(doc.created_at)}
                  {doc.rejection_reason ? <span className="text-destructive"> · {doc.rejection_reason}</span> : null}
                </span>
                <DocumentStatusBadge status={doc.review_status === "rejected" ? "rejected" : "replaced"} />
                <ViewButton doc={doc} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

const REQUEST_VARIANT: Partial<Record<string, BadgeVariant>> = {
  uploaded: "info",
  received: "success",
  waived: "neutral",
};

export function DocumentsTab({ data, reviewable: hasReviewPermission, actions = [] }: { data: VisaCase; reviewable: boolean; actions?: VisaAction[] }) {
  const { application, documentSlots } = data;
  const paid = ["paid", "partially_paid"].includes(data.paymentState);
  const reviewable = hasReviewPermission && paid;
  const requests = application.document_requests;
  const slots = documentSlots.filter((s) => !s.key.startsWith("request:"));
  const currentStatuses = slots.filter(slot => !slot.staff).map(slot => slot.versions.find(doc => doc.is_current)?.review_status ?? "missing");
  const pending = currentStatuses.filter(status => status === "pending").length;
  const verified = currentStatuses.filter(status => status === "accepted").length;
  const replacements = currentStatuses.filter(status => status === "rejected" || status === "missing").length;
  const reviewComplete = data.readiness.some(item => item.key === "documents_reviewed" && item.ok)
    && data.readiness.some(item => item.key === "documents_complete" && item.ok);

  return (
    <div className="space-y-8">
      {!paid && hasReviewPermission ? <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><span className="text-sm font-semibold">Payment required before document review</span><Button size="sm" variant="outline" render={<Link href={data.order ? `/admin/orders?order=${data.order.id}#order-${data.order.id}` : "?tab=payment"} />}>Check payment</Button></div> : null}
      <section className="space-y-3">
        <SectionHeading action={reviewable ? <RequestDocumentDialog applicationId={application.id} /> : null}>
          Documents
        </SectionHeading>
        {paid && reviewComplete ? <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm font-semibold text-primary">Document review complete</div> : null}
        {actions.some(action => ["start_review", "mark_ready", "resume"].includes(action.key)) ? <CaseActions applicationId={application.id} refundNote="" actions={actions.filter(action => ["start_review", "mark_ready", "resume"].includes(action.key))} /> : null}
        <div className="flex flex-wrap gap-2" aria-label="Document review progress"><Badge variant={pending ? "warning" : "neutral"}>{pending} awaiting review</Badge><Badge variant="success">{verified} verified</Badge>{replacements ? <Badge variant="warning">{replacements} missing or need replacement</Badge> : null}</div>
        <Card className="py-0">
          {slots.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <FileStack />
              </EmptyMedia>
              <EmptyTitle>No documents</EmptyTitle>
            </Empty>
          ) : (
            <CardContent className="px-4 sm:px-6">
              <ul className="divide-y divide-border">
                {slots.map((slot) => (
                  <SlotRow key={slot.key} slot={slot} applicationId={application.id} reviewable={reviewable} />
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      </section>

      {requests.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading>Requests</SectionHeading>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const upload = documentSlots
                    .find((s) => s.key === `request:${request.title}`)
                    ?.versions.find((v) => v.is_current && v.request_id === request.id);
                  const open = request.status === "requested" || request.status === "uploaded";
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <p className="font-medium">{request.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {request.requirement}
                          {request.description ? ` · ${request.description}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatDay(request.due_date)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(request.status, REQUEST_VARIANT)} className="capitalize">
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {upload ? (
                          <span className="flex items-center gap-1.5">
                            <DocumentStatusBadge status={upload.review_status} />
                            <ViewButton doc={upload} />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {open && reviewable ? (
                          <ResolveRequestControls requestId={request.id} applicationId={application.id} uploaded={Boolean(upload)} />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
