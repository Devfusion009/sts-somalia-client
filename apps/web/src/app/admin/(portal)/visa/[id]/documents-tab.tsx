import { Check, ExternalLink, FileStack, X } from "lucide-react";
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminResolveDocumentRequest } from "@/modules/visa/admin-actions";
import { DocumentStatusBadge } from "@/modules/visa/components/visa-shared";
import type { VisaCase } from "@/modules/visa/case-queries";
import { DocumentReviewControls } from "./document-review-controls";
import { RequestDocumentDialog } from "./visa-controls";
import { SectionHeading, formatBytes, formatDay, formatWhen } from "./case-ui";

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

export function DocumentsTab({ data, reviewable }: { data: VisaCase; reviewable: boolean }) {
  const { application, documentSlots } = data;
  const requests = application.document_requests;
  const slots = documentSlots.filter((s) => !s.key.startsWith("request:"));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeading action={reviewable ? <RequestDocumentDialog applicationId={application.id} /> : null}>
          Documents
        </SectionHeading>
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
                          <div className="flex justify-end gap-1">
                            <form action={adminResolveDocumentRequest}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <input type="hidden" name="applicationId" value={application.id} />
                              <input type="hidden" name="resolution" value="received" />
                              <SubmitButton
                                size="icon-sm"
                                variant="outline"
                                aria-label="Mark received"
                                title="Mark received"
                                pendingText=""
                              >
                                <Check className="text-primary" />
                              </SubmitButton>
                            </form>
                            <form action={adminResolveDocumentRequest}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <input type="hidden" name="applicationId" value={application.id} />
                              <input type="hidden" name="resolution" value="waived" />
                              <SubmitButton size="icon-sm" variant="ghost" aria-label="Waive" title="Waive" pendingText="">
                                <X />
                              </SubmitButton>
                            </form>
                          </div>
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
