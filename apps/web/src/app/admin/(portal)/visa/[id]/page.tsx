import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Check, Download, ExternalLink, X } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { createClient } from "@/lib/supabase/server";
import { getVisaApplicationAdmin, getVisaOrderAdmin, getVisaProcessingWorkspace, isVisaOrderPaid } from "@/modules/admin/queries";
import { adminResolveDocumentRequest } from "@/modules/visa/admin-actions";
import { countryFlag, countryName } from "@/lib/countries";
import { VisaStatusBadge } from "@/modules/visa/components/visa-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusControl, RequestDocumentDialog, ResultUpload, PartnerControl } from "./visa-controls";
import { DocumentReviewControls } from "./document-review-controls";
import { ManualProcessingWorkspace } from "./manual-processing-workspace";
import { getProvider } from "@/lib/provider-catalog";
import { isPartnerProviderAvailable } from "@/modules/visa/partner/registry";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Review Visa Application" };

function DetailGrid({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminVisaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const application = await getVisaApplicationAdmin(id);
  if (!application || !application.visa_type) notFound();

  const [order, workspace] = await Promise.all([
    getVisaOrderAdmin(application.id),
    getVisaProcessingWorkspace(application.id, application.visa_type.id),
  ]);
  const partnerAvailable =
    workspace.route === "partner" && workspace.providerKey
      ? await isPartnerProviderAvailable(workspace.providerKey)
      : false;
  const canLodgeManually = ["ready_for_processing", "processing"].includes(application.status);
  const supabase = await createClient();
  const signedDocs = await Promise.all(
    application.documents.map(async (doc) => {
      const { data } = await supabase.storage
        .from("visa-documents")
        .createSignedUrl(doc.storage_path, 3600);
      return { ...doc, url: data?.signedUrl ?? null };
    })
  );

  const traveler = (application.traveler_details ?? {}) as Record<string, string>;
  const contact = (application.contact_details ?? {}) as Record<string, string>;
  const travel = (application.travel_details ?? {}) as Record<string, string | boolean | null>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const decided = ["approved", "issued"].includes(application.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <BackLink href="/admin/visa" label="All applications" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none" aria-hidden>
            {countryFlag(application.visa_type.destination_country_code)}
          </span>
          <div>
            <h1 className="font-heading text-xl font-semibold">
              {countryName(application.visa_type.destination_country_code)} —{" "}
              {application.visa_type.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{application.application_ref}</span> · Submitted by{" "}
              {application.submitter?.full_name ?? application.submitter?.email ?? "—"} ·{" "}
              {format(new Date(application.created_at), "dd MMM yyyy, hh:mm a")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {order ? (
            <Badge
              className={cn(
                "border-transparent capitalize",
                order.status === "paid" || order.status === "completed"
                  ? "bg-primary/10 text-primary"
                  : "bg-brand-gold/15 text-brand-gold"
              )}
            >
              {order.status === "pending_payment" ? "Unpaid" : `Order ${order.status.replace("_", " ")}`} ·{" "}
              {order.currency} {Number(order.total).toFixed(0)}
            </Badge>
          ) : (
            <Badge className="border-transparent bg-muted text-muted-foreground">No order</Badge>
          )}
          <VisaStatusBadge status={application.status} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Applicant</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid
                rows={[
                  ["Full Name", traveler.full_name],
                  ["Date of Birth", traveler.date_of_birth],
                  ["Gender", traveler.gender],
                  ["Nationality", traveler.nationality ? countryName(traveler.nationality) : undefined],
                  ["Passport Number", traveler.passport_number],
                  ["Passport Expiry", traveler.passport_expiry],
                  ["Place of Birth", traveler.place_of_birth],
                  [
                    "Country of Birth",
                    traveler.country_of_birth ? countryName(traveler.country_of_birth) : undefined,
                  ],
                  ["Marital Status", traveler.marital_status],
                  ["Occupation", traveler.occupation],
                  ["Email", contact.email],
                  ["Mobile", contact.mobile],
                ]}
              />
            </CardContent>
          </Card>

          {application.members.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Members ({application.members.length}) —{" "}
                  <span className="capitalize">{application.applicant_type}</span> application
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Date of Birth</TableHead>
                      <TableHead>Nationality</TableHead>
                      <TableHead>Passport</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {application.members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.full_name}
                          {member.is_primary ? (
                            <Badge className="ml-2 border-transparent bg-chart-3/10 text-[10px] text-chart-3">
                              Primary
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="capitalize">{member.relationship}</TableCell>
                        <TableCell>{member.date_of_birth ?? "—"}</TableCell>
                        <TableCell>
                          {member.nationality ? countryName(member.nationality) : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {member.passport_number ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Travel Information</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid
                rows={[
                  ["Arrival", str(travel.arrival_date)],
                  ["Departure", str(travel.departure_date)],
                  ["Port of Entry", str(travel.port_of_entry)],
                  ["Port of Exit", str(travel.port_of_exit)],
                  ["Flight No.", str(travel.flight_number)],
                  ["Return Flight No.", str(travel.return_flight_number)],
                  ["Purpose", str(travel.purpose)?.replace("_", " ")],
                  ["Paid by", str(travel.payer)],
                  ["Sponsor / Company", str(travel.sponsor_name)],
                  ["Address / Hotel", str(travel.address)],
                  ["Relatives in destination", travel.has_relatives ? "Yes" : "No"],
                  ["Visited before", travel.visited_before ? "Yes" : "No"],
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Documents ({signedDocs.length})</CardTitle>
              <RequestDocumentDialog applicationId={application.id} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {signedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="space-y-2 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {doc.file_name ?? doc.document_type}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {doc.document_type.replace(/_/g, " ").replace("request:", "requested: ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          className={cn(
                            "border-transparent capitalize",
                            doc.review_status === "accepted"
                              ? "bg-primary/10 text-primary"
                              : doc.review_status === "rejected"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-brand-gold/15 text-brand-gold"
                          )}
                        >
                          {doc.review_status}
                        </Badge>
                        {doc.url ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            render={<a href={doc.url} target="_blank" rel="noreferrer" />}
                            className="gap-1 text-primary"
                          >
                            View <ExternalLink className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {doc.rejection_reason ? (
                      <p className="text-xs text-destructive">{doc.rejection_reason}</p>
                    ) : null}
                    {doc.document_type !== "visa_result" ? (
                      <DocumentReviewControls
                        documentId={doc.id}
                        applicationId={application.id}
                        reviewStatus={doc.review_status}
                      />
                    ) : null}
                  </div>
                ))}
                {signedDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                ) : null}
              </div>

              {application.document_requests.length > 0 ? (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-sm font-semibold">Additional document requests</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {application.document_requests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <p className="font-medium">{request.title}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {request.requirement}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={cn(
                                  "border-transparent capitalize",
                                  request.status === "requested"
                                    ? "bg-brand-gold/15 text-brand-gold"
                                    : request.status === "uploaded"
                                      ? "bg-chart-3/10 text-chart-3"
                                      : "bg-primary/10 text-primary"
                                )}
                              >
                                {request.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {["requested", "uploaded"].includes(request.status) ? (
                                <div className="flex justify-end gap-1.5">
                                  <form action={adminResolveDocumentRequest}>
                                    <input type="hidden" name="requestId" value={request.id} />
                                    <input type="hidden" name="applicationId" value={application.id} />
                                    <input type="hidden" name="resolution" value="received" />
                                    <Button size="sm" variant="outline" type="submit" className="gap-1">
                                      <Check className="size-3.5 text-primary" /> Received
                                    </Button>
                                  </form>
                                  <form action={adminResolveDocumentRequest}>
                                    <input type="hidden" name="requestId" value={request.id} />
                                    <input type="hidden" name="applicationId" value={application.id} />
                                    <input type="hidden" name="resolution" value="waived" />
                                    <Button size="sm" variant="ghost" type="submit" className="gap-1">
                                      <X className="size-3.5" /> Waive
                                    </Button>
                                  </form>
                                </div>
                              ) : (
                                <span className="block text-right text-xs text-muted-foreground capitalize">
                                  {request.status}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status History</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {application.history.map((event) => (
                  <li key={event.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="flex flex-wrap items-center gap-2">
                        <VisaStatusBadge status={event.status} />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), "dd MMM yyyy, hh:mm a")}
                        </span>
                      </p>
                      {event.note ? (
                        <p className="mt-1 text-muted-foreground">{event.note}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {order ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Finance</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border text-sm">
                  <div className="flex items-center justify-between py-2 first:pt-0">
                    <dt className="text-muted-foreground">Visa service price</dt>
                    <dd className="font-medium">{order.currency} {Number(order.subtotal).toFixed(0)}</dd>
                  </div>
                  {Number(order.markup_amount) > 0 ? (
                    <div className="flex items-center justify-between py-2">
                      <dt className="text-muted-foreground">Agency service fee</dt>
                      <dd className="font-medium">{order.currency} {Number(order.markup_amount).toFixed(0)}</dd>
                    </div>
                  ) : null}
                  {Number(order.fee_total) > 0 ? (
                    <div className="flex items-center justify-between py-2">
                      <dt className="text-muted-foreground">STS processing fee</dt>
                      <dd className="font-medium">{order.currency} {Number(order.fee_total).toFixed(0)}</dd>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between py-2">
                    <dt className="font-medium">Total</dt>
                    <dd className="font-semibold">{order.currency} {Number(order.total).toFixed(0)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="font-medium">{order.currency} {order.paid.toFixed(0)}{order.method ? ` — ${order.method}` : ""}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2 last:pb-0">
                    <dt className="text-muted-foreground">Remaining</dt>
                    <dd className="font-medium">{order.currency} {order.remaining.toFixed(0)}</dd>
                  </div>
                </dl>
                {application.status === "rejected" && order.paid > 0 ? (
                  <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    {application.agency_id
                      ? "No refund issued. The agency can file a refund request from their portal."
                      : "No refund issued. This platform has no refund flow for card/mobile-money customers yet — process it outside the system."}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Decision</CardTitle>
            </CardHeader>
            <CardContent>
              {application.status === "submitted" && !isVisaOrderPaid(order?.status) ? (
                <p className="text-sm text-muted-foreground">Awaiting payment.</p>
              ) : (
                // Keyed on status: the lodge form and document review forms move the
                // application from beside this control, and its local selection must
                // follow the row rather than keep offering the transition it just made.
                <StatusControl
                  key={application.status}
                  applicationId={application.id}
                  currentStatus={application.status}
                />
              )}
            </CardContent>
          </Card>

          {workspace.route === "partner" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Partner processing</CardTitle>
              </CardHeader>
              <CardContent>
                <PartnerControl
                  applicationId={application.id}
                  partnerName={getProvider(workspace.providerKey ?? "")?.name ?? workspace.providerKey ?? "Partner"}
                  partnerAvailable={partnerAvailable}
                  partnerRef={application.partner_ref}
                  partnerStatus={application.partner_status}
                  partnerLastSyncedAt={application.partner_last_synced_at}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {workspace.route === "partner" ? "Manual fallback" : "Processing"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ManualProcessingWorkspace
                applicationId={application.id}
                activeJob={workspace.manualActiveJob}
                pastJobs={workspace.manualPastJobs}
                notes={workspace.notes}
                canLodge={canLodgeManually}
              />
            </CardContent>
          </Card>

          {decided ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Download className="size-4 text-primary" /> Visa document
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResultUpload applicationId={application.id} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
