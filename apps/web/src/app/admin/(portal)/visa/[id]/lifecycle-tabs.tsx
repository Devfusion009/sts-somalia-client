import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getProvider } from "@/lib/provider-catalog";
import type { VisaCase } from "@/modules/visa/case-queries";
import { formatInZone } from "@/modules/visa/time";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  CENTRE_STATUS_LABELS,
  DELIVERY_MODE_LABELS,
  PASSPORT_NEXT,
  PASSPORT_STATUS_LABELS,
  PROCESSING_STAGE_LABELS,
  isDueWithin,
  readWorkflow,
} from "@/modules/visa/workflow";
import { PartnerControl, ResultUpload } from "./visa-controls";
import {
  AppointmentOutcome,
  BookAppointmentForm,
  CancelAppointment,
  CentreResponse,
  CorrectDecisionDialog,
  PassportMoveForm,
  ProcessingUpdateForm,
  RecordDecisionForm,
  RecordSubmissionForm,
  RescheduleAppointment,
} from "./lifecycle-forms";
import { SectionHeading, formatDay, formatWhen } from "./case-ui";

const OPEN_STAGES = ["in_review", "additional_info_required", "ready_for_processing", "processing"];

function Pill({ tone, children }: { tone: "good" | "bad" | "warn" | "muted" | "info"; children: React.ReactNode }) {
  return (
    <Badge
      className={cn(
        "border-transparent font-medium",
        tone === "good" && "bg-primary/10 text-primary",
        tone === "bad" && "bg-destructive/10 text-destructive",
        tone === "warn" && "bg-brand-gold/15 text-brand-gold",
        tone === "info" && "bg-chart-3/10 text-chart-3",
        tone === "muted" && "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </Badge>
  );
}

function DocLink({ id, label }: { id: string; label: string }) {
  return (
    <Button variant="link" size="sm" className="h-auto gap-1 p-0" render={<a href={`/api/visa/documents/${id}`} target="_blank" rel="noopener noreferrer" />}>
      {label} <ExternalLink className="size-3" />
    </Button>
  );
}

function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-medium break-words">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------
const APPT_TONE: Record<string, "good" | "bad" | "warn" | "muted" | "info"> = {
  booked: "info",
  attended: "good",
  no_show: "bad",
  cancelled: "muted",
  rescheduled: "muted",
};

export function AppointmentsTab({ data, canManage }: { data: VisaCase; canManage: boolean }) {
  const app = data.application;
  const workflow = readWorkflow(app.workflow);
  const centres = data.centres.map((c) => ({ value: c.id, label: `${c.name} — ${c.city}` }));
  const members = app.members.map((m) => ({ value: m.id, label: m.full_name }));
  const memberName = new Map(app.members.map((m) => [m.id, m.full_name]));
  const canBook = canManage && OPEN_STAGES.includes(app.status);
  const booked = data.appointments.filter((a) => a.status === "booked");
  const past = data.appointments.filter((a) => a.status !== "booked");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {canBook ? (
          <Card>
            <CardContent className="space-y-4">
              <SectionHeading>Book appointment</SectionHeading>
              <BookAppointmentForm
                applicationId={app.id}
                centres={centres}
                members={members}
                biometricsDefault={workflow.requires_biometrics}
              />
            </CardContent>
          </Card>
        ) : null}
        {booked.length > 0 ? (
          <Card>
            <CardContent className="space-y-3">
              <SectionHeading>Upcoming</SectionHeading>
              <ul className="divide-y divide-border">
                {booked.map((a) => {
                  const tz = a.centre?.timezone ?? "Africa/Mogadishu";
                  const due = isDueWithin(a.scheduled_at, 12);
                  return (
                    <li key={a.id} className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{APPOINTMENT_TYPE_LABELS[a.appointment_type]}</p>
                        <Pill tone="info">{formatInZone(a.scheduled_at, tz)}</Pill>
                        {a.biometrics_required ? <Pill tone="muted">Biometrics</Pill> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {a.centre?.name}, {a.centre?.city}
                        {a.confirmation_number ? ` · ${a.confirmation_number}` : ""}
                        {a.member_id ? ` · ${memberName.get(a.member_id) ?? ""}` : ""}
                      </p>
                      {canManage ? (
                        <div className="flex items-center gap-1">
                          <AppointmentOutcome
                            applicationId={app.id}
                            appointmentId={a.id}
                            biometricsRequired={a.biometrics_required}
                            due={due}
                          />
                          <RescheduleAppointment
                            applicationId={app.id}
                            appointmentId={a.id}
                            centreId={a.centre_id}
                            centres={centres.length ? centres : [{ value: a.centre_id, label: a.centre?.name ?? "Centre" }]}
                          />
                          <CancelAppointment applicationId={app.id} appointmentId={a.id} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="h-fit">
        <CardContent className="space-y-3">
          <SectionHeading>History</SectionHeading>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past appointments.</p>
          ) : (
            <ol className="divide-y divide-border">
              {past.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {APPOINTMENT_TYPE_LABELS[a.appointment_type]} ·{" "}
                      {formatInZone(a.scheduled_at, a.centre?.timezone ?? "Africa/Mogadishu")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.centre?.name}
                      {a.biometrics_completed ? " · biometrics taken" : ""}
                      {a.status_reason ? ` · ${a.status_reason}` : ""}
                    </p>
                  </div>
                  <Pill tone={APPT_TONE[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Pill>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------
export function SubmissionTab({
  data,
  canSubmit,
  canUpdate,
  partnerAvailable,
}: {
  data: VisaCase;
  canSubmit: boolean;
  canUpdate: boolean;
  partnerAvailable: boolean;
}) {
  const app = data.application;
  const job = data.activeJob;
  const ready = app.status === "ready_for_processing";
  const centres = data.centres.map((c) => ({ value: c.id, label: `${c.name} — ${c.city}` }));
  const attended = data.appointments
    .filter((a) => a.status === "attended")
    .map((a) => ({
      value: a.id,
      label: `${APPOINTMENT_TYPE_LABELS[a.appointment_type]} · ${formatInZone(a.scheduled_at, a.centre?.timezone ?? "Africa/Mogadishu")}`,
    }));
  const past = data.jobs.filter((j) => j.status !== "active");
  const blocker = data.readiness.find((r) => ["appointment", "biometrics", "passport"].includes(r.key) && r.applies && !r.ok);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {ready && canSubmit ? (
          <Card>
            <CardContent className="space-y-4">
              <SectionHeading action={blocker ? <Pill tone="warn">{blocker.label} outstanding</Pill> : null}>
                Record submission
              </SectionHeading>
              <RecordSubmissionForm applicationId={app.id} centres={centres} appointments={attended} />
            </CardContent>
          </Card>
        ) : null}

        {ready && canSubmit && data.workspace.route === "partner" ? (
          <Card>
            <CardContent className="space-y-4">
              <SectionHeading>Partner</SectionHeading>
              <PartnerControl
                applicationId={app.id}
                partnerName={getProvider(data.workspace.providerKey ?? "")?.name ?? data.workspace.providerKey ?? "Partner"}
                partnerAvailable={partnerAvailable}
                partnerRef={app.partner_ref}
                partnerStatus={app.partner_status}
                partnerLastSyncedAt={app.partner_last_synced_at}
              />
            </CardContent>
          </Card>
        ) : null}

        {job ? (
          <Card>
            <CardContent className="space-y-4">
              <SectionHeading
                action={
                  <Pill tone={job.centre_status === "accepted" ? "good" : "info"}>
                    {CENTRE_STATUS_LABELS[job.centre_status]}
                  </Pill>
                }
              >
                Current submission
              </SectionHeading>
              <Facts
                rows={[
                  ["Lodged with", job.route === "partner" ? getProvider(job.provider_key ?? "")?.name ?? job.provider_key : job.lodged_with],
                  ["Reference", <span key="ref" className="font-mono text-xs">{job.lodgement_reference ?? job.partner_ref ?? "—"}</span>],
                  ["Submitted", formatDay(job.submitted_at ?? job.lodgement_date)],
                  ["Processing", PROCESSING_STAGE_LABELS[job.processing_stage]],
                  ...(job.route === "partner" ? ([["Partner status", job.partner_status?.replace(/_/g, " ") ?? "—"]] as Array<[string, string]>) : []),
                  ...(job.receipt_document_id ? ([["Receipt", <DocLink key="rc" id={job.receipt_document_id} label="Open" />]] as Array<[string, React.ReactNode]>) : []),
                ]}
              />
              {app.status === "processing" && canSubmit ? (
                <CentreResponse applicationId={app.id} accepted={job.centre_status === "accepted"} />
              ) : null}
              {job.route === "partner" && canSubmit ? (
                <PartnerControl
                  applicationId={app.id}
                  partnerName={getProvider(job.provider_key ?? "")?.name ?? job.provider_key ?? "Partner"}
                  partnerAvailable
                  partnerRef={app.partner_ref}
                  partnerStatus={app.partner_status}
                  partnerLastSyncedAt={app.partner_last_synced_at}
                />
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {!job && !ready ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">Not submitted.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-4">
        {job && app.status === "processing" && canUpdate ? (
          <Card>
            <CardContent className="space-y-4">
              <SectionHeading>Processing update</SectionHeading>
              <ProcessingUpdateForm applicationId={app.id} current={job.processing_stage} />
            </CardContent>
          </Card>
        ) : null}
        {past.length > 0 ? (
          <Card>
            <CardContent className="space-y-3">
              <SectionHeading>Earlier attempts</SectionHeading>
              <ol className="divide-y divide-border">
                {past.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {j.route === "partner" ? getProvider(j.provider_key ?? "")?.name ?? j.provider_key : j.lodged_with}
                        {j.lodgement_reference ?? j.partner_ref ? ` · ${j.lodgement_reference ?? j.partner_ref}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(j.created_at)}
                        {j.returned_reason ?? j.failure_reason ? ` · ${j.returned_reason ?? j.failure_reason}` : ""}
                      </p>
                    </div>
                    <Pill tone={j.status === "failed" ? "bad" : "muted"}>
                      {j.centre_status === "returned_for_correction" ? "Returned" : j.status}
                    </Pill>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------
export function DecisionTab({
  data,
  canDecide,
  canCorrect,
}: {
  data: VisaCase;
  canDecide: boolean;
  canCorrect: boolean;
}) {
  const app = data.application;
  const workflow = readWorkflow(app.workflow);
  const current = data.currentDecision;
  const earlier = data.decisions.filter((d) => d.id !== current?.id);
  const job = data.activeJob ?? data.jobs[0] ?? null;
  const defaultAuthority = job?.lodged_with ?? job?.provider_key ?? "";
  const result = data.documentSlots.find((s) => s.key === "visa_result")?.versions.find((v) => v.is_current) ?? null;
  const showResult = canDecide && ["approved", "issued"].includes(app.status) && !workflow.requires_physical_passport;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {app.status === "processing" && canDecide ? (
          <Card>
            <CardContent className="space-y-4">
              <SectionHeading>Record decision</SectionHeading>
              <RecordDecisionForm applicationId={app.id} authority={defaultAuthority} />
            </CardContent>
          </Card>
        ) : null}

        {current ? (
          <Card>
            <CardContent className="space-y-4">
              <SectionHeading
                action={<Pill tone={current.outcome === "approved" ? "good" : "bad"}>{current.outcome === "approved" ? "Approved" : "Refused"}</Pill>}
              >
                Decision
              </SectionHeading>
              <Facts
                rows={[
                  ["Authority", current.authority],
                  ["Reference", current.authority_reference ?? "—"],
                  ["Decision date", formatDay(current.decision_date)],
                  ["Recorded", `${current.recorder?.full_name ?? (current.source === "partner" ? "Partner" : "System")} · ${formatWhen(current.recorded_at)}`],
                  ...(current.letter_document_id ? ([["Letter", <DocLink key="l" id={current.letter_document_id} label="Open" />]] as Array<[string, React.ReactNode]>) : []),
                  ...(current.correction_reason ? ([["Correction", current.correction_reason]] as Array<[string, string]>) : []),
                ]}
              />
              {canCorrect && ["approved", "rejected", "issued"].includes(app.status) ? (
                <CorrectDecisionDialog applicationId={app.id} decisionId={current.id} currentOutcome={current.outcome} />
              ) : null}
            </CardContent>
          </Card>
        ) : app.status !== "processing" ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">No decision yet.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-4">
        {showResult || result ? (
          <Card>
            <CardContent className="space-y-4">
              <SectionHeading action={result ? <DocLink id={result.id} label={`v${result.version}`} /> : null}>
                Issued visa
              </SectionHeading>
              {showResult ? <ResultUpload applicationId={app.id} /> : null}
            </CardContent>
          </Card>
        ) : null}
        {earlier.length > 0 ? (
          <Card>
            <CardContent className="space-y-3">
              <SectionHeading>Superseded</SectionHeading>
              <ol className="divide-y divide-border">
                {earlier.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {d.outcome === "approved" ? "Approved" : "Refused"} · {d.authority}
                        {d.authority_reference ? ` · ${d.authority_reference}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.recorder?.full_name ?? d.source} · {formatWhen(d.recorded_at)}
                      </p>
                    </div>
                    <Pill tone="muted">Superseded</Pill>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Passports
// ---------------------------------------------------------------------------
const PASSPORT_TONE: Record<string, "good" | "bad" | "warn" | "muted" | "info"> = {
  with_applicant: "muted",
  with_sts: "info",
  with_centre: "info",
  in_transit: "info",
  ready_for_collection: "warn",
  out_for_delivery: "warn",
  delivered: "good",
  collected: "good",
};

export function PassportTab({ data, canManage }: { data: VisaCase; canManage: boolean }) {
  const app = data.application;
  const workflow = readWorkflow(app.workflow);
  const eventsByPassport = new Map<string, VisaCase["passportEvents"]>();
  for (const e of data.passportEvents) {
    const list = eventsByPassport.get(e.passport_id) ?? [];
    list.push(e);
    eventsByPassport.set(e.passport_id, list);
  }

  if (data.passports.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">No passports held for this case.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.passports.map((p) => {
        const history = eventsByPassport.get(p.id) ?? [];
        return (
          <Card key={p.id}>
            <CardContent className="space-y-4">
              <SectionHeading action={<Pill tone={PASSPORT_TONE[p.status]}>{PASSPORT_STATUS_LABELS[p.status]}</Pill>}>
                {p.holder_name ?? "Passport"}
              </SectionHeading>
              {p.delivery_mode || p.tracking_reference || p.collector_name ? (
                <Facts
                  rows={[
                    ...(p.delivery_mode ? ([["Return", DELIVERY_MODE_LABELS[p.delivery_mode]]] as Array<[string, string]>) : []),
                    ...(p.tracking_reference ? ([["Tracking", p.tracking_reference]] as Array<[string, string]>) : []),
                    ...(p.collector_name ? ([["Collected by", p.collector_name]] as Array<[string, string]>) : []),
                    ...(p.authorization_document_id
                      ? ([["Authorisation", <DocLink key="a" id={p.authorization_document_id} label="Open" />]] as Array<[string, React.ReactNode]>)
                      : []),
                  ]}
                />
              ) : null}
              {canManage && app.status !== "cancelled" ? (
                <PassportMoveForm
                  applicationId={app.id}
                  passportId={p.id}
                  next={PASSPORT_NEXT[p.status] ?? []}
                  deliveryModes={workflow.passport_delivery_modes}
                />
              ) : null}
              {history.length > 0 ? (
                <ol className="divide-y divide-border border-t border-border">
                  {history.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-2 py-2 text-xs">
                      <span>
                        <span className="font-medium text-foreground">{PASSPORT_STATUS_LABELS[e.to_status] ?? e.to_status}</span>
                        {e.reference ? ` · ${e.reference}` : ""}
                        {e.note ? <span className="text-muted-foreground"> · {e.note}</span> : null}
                      </span>
                      <time className="shrink-0 text-muted-foreground tabular-nums">{formatWhen(e.created_at)}</time>
                    </li>
                  ))}
                </ol>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
