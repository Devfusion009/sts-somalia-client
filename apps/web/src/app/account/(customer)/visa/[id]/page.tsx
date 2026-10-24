import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, Download, FileText, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { countryFlag, countryName } from "@/lib/countries";
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusTimeline } from "@/modules/bookings/components/status-timeline";
import { getApplicationDetail, getOrderForVisaApplication } from "@/modules/visa/queries";
import { applicationDocumentSlots } from "@/modules/visa/schemas";
import { visaCustomerProgress, visaNextAction } from "@/modules/visa/progress";
import { formatInZone } from "@/modules/visa/time";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  PASSPORT_STATUS_LABELS,
  type VisaStage,
} from "@/modules/visa/workflow";
import { VisaStatusBadge, fmtMoney } from "@/modules/visa/components/visa-shared";
import { NextActionCard } from "@/modules/visa/components/next-action-card";
import { MessageThread } from "@/modules/visa/components/message-thread";
import { MessageComposer } from "@/modules/visa/components/message-composer";
import { RequestUpload } from "@/modules/visa/components/request-upload";
import { ReplaceUpload } from "@/modules/visa/components/replace-upload";
import { sendVisaMessage } from "@/modules/visa/actions";

export const metadata: Metadata = { title: "Visa Application" };

const STAFF_DOCS = new Set(["visa_result", "decision_letter", "submission_receipt", "passport_authorization"]);

const DOC_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Received", variant: "info" },
  accepted: { label: "Verified", variant: "success" },
  rejected: { label: "Replace", variant: "destructive" },
};

const APPOINTMENT_VARIANT: Partial<Record<string, BadgeVariant>> = {
  booked: "info",
  attended: "success",
  no_show: "destructive",
  cancelled: "neutral",
  rescheduled: "neutral",
};

function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="scroll-mt-24 font-heading text-base font-semibold">
      {children}
    </h2>
  );
}

export default async function VisaTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();

  const application = await getApplicationDetail(id);
  if (!application || !application.visa_type || application.status === "draft") notFound();
  const visaType = application.visa_type;
  const order = await getOrderForVisaApplication(application.id);

  const slots = applicationDocumentSlots(application);
  const slotLabel = new Map(slots.map((s) => [s.key, s.label]));
  const labelFor = (type: string) =>
    type.startsWith("request:") ? type.slice(8) : (slotLabel.get(type) ?? type.replace(/_/g, " "));

  const decisions = application.decisions;
  const superseded = new Set(decisions.map((d) => d.supersedes_id).filter(Boolean));
  const decision = decisions.find((d) => !superseded.has(d.id)) ?? null;

  const input = {
    status: application.status as VisaStage,
    workflow: application.workflow,
    orderStatus: order?.status ?? null,
    orderId: order?.id ?? null,
    orderTotal: order ? fmtMoney(order.total, order.currency) : null,
    documents: application.documents,
    requests: application.document_requests,
    appointments: application.appointments,
    passports: application.passports,
    decisionOutcome: (decision?.outcome as "approved" | "refused" | undefined) ?? null,
  };
  const progress = visaCustomerProgress(input);
  const next = visaNextAction(input, labelFor);

  const currentDocs = application.documents
    .filter((d) => d.is_current && !STAFF_DOCS.has(d.document_type) && !d.request_id)
    .sort((a, b) => labelFor(a.document_type).localeCompare(labelFor(b.document_type)));
  const result = application.documents.find((d) => d.document_type === "visa_result" && d.is_current);
  const letter = decision?.letter_document_id ?? null;
  // Submit logs both the submission and the stage change with the same customer text.
  const updates = application.events.filter(
    (e, i, all) =>
      !e.event_type.startsWith("message.") &&
      e.customer_summary &&
      e.customer_summary !== all[i - 1]?.customer_summary
  );
  const balance = order ? Number(order.total) - Number(order.paid) : 0;
  const balanceDue = !!order && balance > 0.005 && ["pending_payment", "held", "partially_paid"].includes(order.status);
  const approved = application.status === "approved" || application.status === "issued";
  const travellers = application.applicant_type === "single" ? 1 : Math.max(application.members.length, 1);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-3">
        <Link
          href="/account/visa"
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" /> Visa applications
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none" aria-hidden="true">
            {countryFlag(visaType.destination_country_code)}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="font-heading text-2xl font-semibold tracking-tight break-words">
                {countryName(visaType.destination_country_code)}
              </h1>
              <VisaStatusBadge status={application.status} />
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {visaType.name} · <span className="font-mono">{application.application_ref}</span>
              {application.submitted_at ? ` · ${format(new Date(application.submitted_at), "d MMM yyyy")}` : ""}
              {` · ${travellers} traveller${travellers === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      </header>

      <NextActionCard action={next} />

      <Card>
        <CardHeader>
          <CardTitle>{progress.stepLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusTimeline stages={progress.stages} currentIndex={progress.index} outcome={progress.outcome} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-6">
          {decision ? (
            <section className="space-y-3">
              <SectionTitle>Decision</SectionTitle>
              <Card>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {approved ? (
                      <CheckCircle2 className="size-6 shrink-0 text-primary" aria-hidden="true" />
                    ) : (
                      <XCircle className="size-6 shrink-0 text-destructive" aria-hidden="true" />
                    )}
                    <div>
                      <p className="font-heading text-lg font-semibold">{approved ? "Approved" : "Refused"}</p>
                      <p className="text-sm text-muted-foreground">
                        {decision.authority} · {format(new Date(decision.decision_date), "d MMM yyyy")}
                      </p>
                    </div>
                  </div>
                  {approved ? (
                    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border text-sm [&>div]:bg-secondary/40 [&>div]:px-3 [&>div]:py-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Validity</dt>
                        <dd className="font-medium">{visaType.validity_days ? `${visaType.validity_days} days` : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Stay</dt>
                        <dd className="font-medium">{visaType.stay_days ? `${visaType.stay_days} days` : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Entries</dt>
                        <dd className="font-medium capitalize">{visaType.entry_type}</dd>
                      </div>
                    </dl>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {result ? (
                      <Button
                        render={<a href={`/api/visa/documents/${result.id}`} target="_blank" rel="noopener noreferrer" />}
                      >
                        <Download data-icon="inline-start" aria-hidden="true" /> Download visa
                      </Button>
                    ) : null}
                    {letter ? (
                      <Button
                        variant="outline"
                        render={<a href={`/api/visa/documents/${letter}`} target="_blank" rel="noopener noreferrer" />}
                      >
                        <FileText data-icon="inline-start" aria-hidden="true" /> Decision letter
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </section>
          ) : null}

          <section className="space-y-3">
            <SectionTitle id="documents">Documents</SectionTitle>
            <Card className="py-0">
              <CardContent className="px-4">
                <ul className="divide-y divide-border">
                  {currentDocs.map((doc) => {
                    const status = DOC_STATUS[doc.review_status] ?? DOC_STATUS.pending;
                    return (
                      <li key={doc.id} className="space-y-2 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="min-w-0 flex-1 text-sm font-medium">{labelFor(doc.document_type)}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {doc.review_status === "rejected" ? (
                            <ReplaceUpload documentId={doc.id} applicationId={application.id} />
                          ) : null}
                        </div>
                        {doc.review_status === "rejected" && doc.rejection_reason ? (
                          <p className="text-sm text-destructive">{doc.rejection_reason}</p>
                        ) : null}
                      </li>
                    );
                  })}
                  {currentDocs.length === 0 && application.document_requests.length === 0 ? (
                    <li className="py-6 text-center text-sm text-muted-foreground">No documents</li>
                  ) : null}
                  {application.document_requests.map((request) => (
                    <li key={request.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{request.title}</p>
                        {request.description || request.due_date ? (
                          <p className="text-sm text-muted-foreground">
                            {request.description}
                            {request.due_date ? `${request.description ? " · " : ""}by ${format(new Date(request.due_date), "d MMM yyyy")}` : ""}
                          </p>
                        ) : null}
                      </div>
                      {request.status === "requested" ? (
                        <RequestUpload requestId={request.id} applicationId={application.id} />
                      ) : (
                        <Badge
                          variant={
                            request.status === "waived" ? "neutral" : request.status === "uploaded" ? "info" : "success"
                          }
                        >
                          {request.status === "uploaded" ? "Received" : request.status === "waived" ? "Not needed" : "Verified"}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          {application.appointments.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle>Appointments</SectionTitle>
              <Card className="py-0">
                <CardContent className="px-4">
                  <ul className="divide-y divide-border">
                    {application.appointments.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {APPOINTMENT_TYPE_LABELS[a.appointment_type]} ·{" "}
                            {formatInZone(a.scheduled_at, a.centre?.timezone ?? "Africa/Mogadishu")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {a.centre?.name}
                            {a.centre?.address ? `, ${a.centre.address}` : ""}
                            {a.confirmation_number ? ` · ${a.confirmation_number}` : ""}
                          </p>
                        </div>
                        <Badge variant={statusBadgeVariant(a.status, APPOINTMENT_VARIANT)}>
                          {APPOINTMENT_STATUS_LABELS[a.status]}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ) : null}

          {application.passports.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle>Passports</SectionTitle>
              <Card className="py-0">
                <CardContent className="px-4">
                  <ul className="divide-y divide-border">
                    {application.passports.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                        <span className="font-medium">{p.holder_name ?? "Passport"}</span>
                        <span className="flex items-center gap-2">
                          {p.tracking_reference ? (
                            <span className="font-mono text-xs text-muted-foreground">{p.tracking_reference}</span>
                          ) : null}
                          <Badge variant="neutral">{PASSPORT_STATUS_LABELS[p.status]}</Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="space-y-3">
            <SectionTitle>Messages</SectionTitle>
            <Card>
              <CardContent className="space-y-4">
                <MessageThread messages={application.messages} viewer="customer" />
                <MessageComposer applicationId={application.id} action={sendVisaMessage} placeholder="Message STS" />
              </CardContent>
            </Card>
          </section>

          {updates.length > 0 ? (
            <section className="space-y-3">
              <SectionTitle>Updates</SectionTitle>
              <Card className="py-0">
                <CardContent className="px-4">
                  <ol className="divide-y divide-border">
                    {updates.map((e) => (
                      <li key={e.id} className="space-y-0.5 py-2.5 text-sm">
                        <p>{e.customer_summary}</p>
                        <time className="text-sm text-muted-foreground tabular-nums" dateTime={e.created_at}>
                          {format(new Date(e.created_at), "d MMM yyyy, HH:mm")}
                        </time>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </section>
          ) : null}

          {order ? (
            <section className="space-y-3">
              <SectionTitle>Payment</SectionTitle>
              <Card>
                <CardContent>
                  <dl className="divide-y divide-border text-sm">
                    <div className="flex justify-between py-2 first:pt-0">
                      <dt className="text-muted-foreground">Visa fee</dt>
                      <dd className="font-medium tabular-nums">{fmtMoney(order.subtotal, order.currency)}</dd>
                    </div>
                    {Number(order.fee_total) > 0 ? (
                      <div className="flex justify-between py-2">
                        <dt className="text-muted-foreground">Processing fee</dt>
                        <dd className="font-medium tabular-nums">{fmtMoney(order.fee_total, order.currency)}</dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between py-2">
                      <dt className="font-medium">Total</dt>
                      <dd className="font-semibold tabular-nums">{fmtMoney(order.total, order.currency)}</dd>
                    </div>
                    <div className="flex justify-between py-2 last:pb-0">
                      <dt className="text-muted-foreground">Paid{order.method ? ` · ${order.method}` : ""}</dt>
                      <dd className="font-medium tabular-nums">{fmtMoney(order.paid, order.currency)}</dd>
                    </div>
                    {balanceDue ? (
                      <div className="flex items-center justify-between py-2 last:pb-0">
                        <dt className="font-medium">Balance due</dt>
                        <dd className="flex items-center gap-3">
                          <span className="font-semibold tabular-nums">{fmtMoney(balance, order.currency)}</span>
                          <Button render={<Link href={`/checkout/${order.id}`} />}>Pay</Button>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </CardContent>
              </Card>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
