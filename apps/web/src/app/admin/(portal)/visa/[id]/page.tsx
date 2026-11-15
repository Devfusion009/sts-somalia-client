import { CaseLiveSync } from "@/modules/visa/components/case-live-sync";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { CalendarDays, CreditCard, FileCheck2, History, LayoutDashboard, MessageSquare, NotebookPen, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { countryFlag, countryName } from "@/lib/countries";
import { getVisaCase, getVisaStaff } from "@/modules/visa/case-queries";
import { requireVisaPermission } from "@/modules/visa/staff-auth";
import { visaStaffCan, type VisaPermission } from "@/modules/visa/permissions";
import {
  CENTRE_STATUS_LABELS,
  CLOSED_STAGES,
  PAYMENT_STATE_LABELS,
  daysSince,
  isPast,
  readWorkflow,
  visaAvailableActions,
  type VisaStage,
} from "@/modules/visa/workflow";
import { formatInZone } from "@/modules/visa/time";
import { isPartnerProviderAvailable } from "@/modules/visa/partner/registry";
import { ActivityTab, ApplicantTab, MessagesTab, NotesTab, OverviewTab, PaymentTab } from "./case-tabs";
import { AppointmentsTab, DecisionTab, PassportTab, SubmissionTab } from "./lifecycle-tabs";
import { DocumentsTab } from "./documents-tab";
import { StageBadge, Stat, isCaseTab } from "./case-ui";
import { CaseProgress } from "./case-progress";
import { CaseAssign } from "./case-assign";

export const metadata: Metadata = { title: "Visa Case" };

const CASE_TAB_CLASS = "h-10 flex-none gap-2 rounded-lg px-3 text-xs font-semibold data-active:text-primary after:bg-primary sm:text-sm";

function Dot() {
  return (
    <span aria-hidden className="text-border">
      ·
    </span>
  );
}

export default async function AdminVisaCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const profile = await requireVisaPermission("visa.applications.read");
  const [data, staff] = await Promise.all([getVisaCase(id), getVisaStaff()]);
  if (!data) notFound();

  const can = (perm: VisaPermission) => visaStaffCan(profile, perm);
  const app = data.application;
  const visaType = app.visa_type!;
  const stage = app.status as VisaStage;
  const closed = CLOSED_STAGES.includes(stage);
  const traveler = (app.traveler_details ?? {}) as Record<string, string>;
  const applicantName = traveler.full_name || app.submitter?.full_name || app.submitter?.email || "Applicant";
  const workflow = readWorkflow(app.workflow);
  const showAppointments = workflow.requires_appointment || workflow.requires_biometrics || data.appointments.length > 0;
  const showPassport = workflow.requires_physical_passport || data.passports.length > 0;
  const requested = isCaseTab(tab) ? tab : "overview";
  const initialTab =
    (requested === "appointments" && !showAppointments) || (requested === "passport" && !showPassport)
      ? "overview"
      : requested;

  const actions = visaAvailableActions(
    {
      stage,
      paymentState: data.paymentState,
      infoReturnStage: (app.info_return_stage as VisaStage | null) ?? null,
      readiness: data.readiness,
      workflow,
      hasResultDocument: data.application.documents.some((d) => d.document_type === "visa_result" && d.is_current),
      hasBookedAppointment: data.appointments.some((a) => a.status === "booked"),
    },
    can
  );

  const partnerAvailable =
    data.workspace.route === "partner" && data.workspace.providerKey
      ? await isPartnerProviderAvailable(data.workspace.providerKey)
      : false;

  // Stat rail
  const docSlots = data.documentSlots.filter((s) => !s.staff && !s.key.startsWith("request:"));
  const currentDocs = docSlots.map((s) => s.versions.find((v) => v.is_current)).filter(Boolean);
  const verified = currentDocs.filter((d) => d!.review_status === "accepted").length;
  const pendingReview = data.application.documents.filter(
    (d) => d.is_current && d.review_status === "pending" && d.document_type !== "visa_result"
  ).length;
  const stageEvent = data.events.find((e) => e.event_type === "stage.changed" && e.to_stage === stage);
  const inStage = daysSince(stageEvent?.created_at ?? app.submitted_at ?? app.created_at);
  const sla = data.ops?.sla_due_at ? new Date(data.ops.sla_due_at) : null;
  const overdue = !closed && isPast(data.ops?.sla_due_at);
  const travellers = app.applicant_type === "single" ? 1 : Math.max(app.members.length, 1);
  const owner = data.ops?.assignee?.full_name ?? data.ops?.assignee?.email ?? null;
  const nextAppointment = data.appointments
    .filter((a) => a.status === "booked")
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const attendanceChecks = data.readiness.filter(item => ["appointment", "biometrics"].includes(item.key) && item.applies);
  const attended = attendanceChecks.length > 0
    ? attendanceChecks.every(item => item.ok)
    : data.appointments.some(a => a.status === "attended");
  const passportsBack = data.passports.filter((p) => ["delivered", "collected"].includes(p.status)).length;
  const decision = data.currentDecision;
  const awaitingReply = (data.messages.at(-1)?.author_kind ?? "staff") !== "staff";

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <BackLink href="/admin/visa" label="All applications" />
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{applicantName}</h1>
            {stage === "in_review" && data.readiness.some(item => item.key === "documents_reviewed" && item.ok) ? <Badge variant="success">Document review complete</Badge> : <StageBadge stage={stage} />}
              {data.ops?.priority === "urgent" ? <Badge variant="destructive">Urgent</Badge> : null}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span className="font-mono text-foreground">{app.application_ref}</span>
              <Dot />
              <span>
                <span aria-hidden>{countryFlag(visaType.destination_country_code)}</span>{" "}
                {countryName(visaType.destination_country_code)}
              </span>
              <Dot />
              <span>{visaType.name}</span>
              <Dot />
              <span className="capitalize">{visaType.entry_type} entry</span>
              {app.submitted_at ? (
                <>
                  <Dot />
                  <span className="tabular-nums">Submitted {format(new Date(app.submitted_at), "d MMM yyyy")}</span>
                </>
              ) : null}
              <Dot />
              <span>{owner ?? "Unassigned"}</span>
            </p>
          </div>
          {!closed ? (
            <CaseAssign
              applicationId={app.id}
              assignedTo={data.ops?.assigned_to ?? null}
              meId={profile.id}
              priority={data.ops?.priority ?? "normal"}
              staff={staff}
              canAssign={can("visa.assign")}
            />
          ) : null}
        </header>

        <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl bg-secondary/40 px-4 py-3">
          <Stat label="In stage" value={inStage === null ? "—" : `${inStage}d`} tone={!closed && (inStage ?? 0) > 3 ? "warn" : undefined} />
          <Stat label="Documents" value={`${verified}/${docSlots.length} verified`} />
          <Stat
            label="Payment"
            value={PAYMENT_STATE_LABELS[data.paymentState]}
            tone={data.paymentState === "pending" ? "warn" : undefined}
          />
          <Stat label="Travellers" value={travellers} />
          {showAppointments ? (
            <Stat
              label="Appointment"
              value={
                nextAppointment
                  ? formatInZone(nextAppointment.scheduled_at, nextAppointment.centre?.timezone ?? "Africa/Mogadishu")
                  : attended
                    ? "Attended"
                    : "Not booked"
              }
              tone={!nextAppointment && !attended && !closed ? "warn" : undefined}
            />
          ) : null}
          {data.activeJob ? <Stat label="Submission" value={CENTRE_STATUS_LABELS[data.activeJob.centre_status]} /> : null}
          {decision ? (
            <Stat
              label="Decision"
              value={decision.outcome === "approved" ? "Approved" : "Refused"}
              tone={decision.outcome === "refused" ? "danger" : undefined}
            />
          ) : null}
          {showPassport && data.passports.length > 0 ? (
            <Stat label="Passports back" value={`${passportsBack}/${data.passports.length}`} />
          ) : null}
          {sla && !closed ? (
            <Stat label={overdue ? "Overdue since" : "Due"} value={format(sla, "d MMM")} tone={overdue ? "danger" : undefined} />
          ) : null}
        </dl>
      </div>

      <CaseLiveSync enabled={!closed} />
      <CaseProgress data={data} />

      <Tabs key={initialTab} defaultValue={initialTab}>
        <div className="overflow-x-auto rounded-xl border border-border bg-card px-2 shadow-xs">
          <TabsList variant="line" aria-label="Application sections" className="min-w-full justify-start gap-1 px-1 group-data-horizontal/tabs:h-14 sm:gap-3">
            <TabsTrigger value="overview" className={CASE_TAB_CLASS}><LayoutDashboard aria-hidden="true" />Overview</TabsTrigger>
            <TabsTrigger value="applicant" className={CASE_TAB_CLASS}><UsersRound aria-hidden="true" />Applicants</TabsTrigger>
            <TabsTrigger value="documents" className={CASE_TAB_CLASS}>
              <FileCheck2 aria-hidden="true" />Documents
              {pendingReview > 0 ? (
                <Badge variant="warning" className="tabular-nums">
                  {pendingReview}
                </Badge>
              ) : null}
            </TabsTrigger>
            {showAppointments ? <TabsTrigger value="appointments" className={CASE_TAB_CLASS}><CalendarDays aria-hidden="true" />Appointments</TabsTrigger> : null}
            {showPassport ? <TabsTrigger value="passport" className={CASE_TAB_CLASS}>Passport</TabsTrigger> : null}
            <TabsTrigger value="payment" className={CASE_TAB_CLASS}><CreditCard aria-hidden="true" />Payment</TabsTrigger>
            <TabsTrigger value="activity" className={CASE_TAB_CLASS}>
              <History aria-hidden="true" />Activity
              {awaitingReply ? (
                <span className="size-1.5 rounded-full bg-brand-gold" role="img" aria-label="Awaiting reply" />
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab data={data} actions={actions} reviewable={!closed && can("visa.documents.review")} />
        </TabsContent>
        <TabsContent value="applicant" className="mt-4">
          <ApplicantTab data={data} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab data={data} reviewable={!closed && can("visa.documents.review")} actions={actions} />
        </TabsContent>
        <TabsContent value="messages" aria-label="Messages" className="mt-4">
          <MessagesTab data={data} canSend={can("visa.messages.send")} />
        </TabsContent>
        <TabsContent value="payment" className="mt-4">
          <PaymentTab data={data} />
        </TabsContent>
        {showAppointments ? (
          <TabsContent value="appointments" className="mt-4">
            <AppointmentsTab data={data} canManage={!closed && can("visa.appointments.manage")} />
          </TabsContent>
        ) : null}
        <TabsContent value="submission" aria-label="Visa office submission" className="mt-4">
          <SubmissionTab
            data={data}
            canSubmit={can("visa.submission.record")}
            canUpdate={can("visa.processing.update")}
            partnerAvailable={partnerAvailable}
          />
        </TabsContent>
        <TabsContent value="decision" aria-label="Visa decision" className="mt-4">
          <DecisionTab data={data} canDecide={can("visa.decision.record")} canCorrect={can("visa.decision.correct")} />
        </TabsContent>
        {showPassport ? (
          <TabsContent value="passport" className="mt-4">
            <PassportTab data={data} canManage={can("visa.passport.manage")} />
          </TabsContent>
        ) : null}
        {can("visa.notes.read") ? (
          <TabsContent value="notes" aria-label="Internal notes" className="mt-4">
            <NotesTab data={data} canWrite={can("visa.notes.write")} />
          </TabsContent>
        ) : null}
        <TabsContent value="activity" className="mt-4">
          <div className="mb-5 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" render={<Link href="?tab=messages" scroll={false} />}><MessageSquare className="size-4" aria-hidden="true" />Messages{awaitingReply ? <Badge variant="warning">Reply needed</Badge> : null}</Button>
            {can("visa.notes.read") ? <Button variant="outline" size="sm" render={<Link href="?tab=notes" scroll={false} />}><NotebookPen className="size-4" aria-hidden="true" />Internal notes</Button> : null}
          </div>
          <ActivityTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
