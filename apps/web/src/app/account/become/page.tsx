import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Inbox, MessageSquareWarning, XCircle, Plane, Building2, CalendarDays, Handshake, ArrowUpRight, FileText, Clock3 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { APP_CONFIG, REJECT_COOLDOWN_DAYS, canApplicantEdit, docSlotsFor, type ApplicationKind } from "@/modules/partner-applications/config";
import { getLatestApplication, getRecentApplications, getRejectedDocumentKeys, type RecentApplication } from "@/modules/partner-applications/queries";
import { startApplication } from "@/modules/partner-applications/actions";
import { DraftProgressCard } from "@/modules/partner-applications/components/draft-progress-card";
import { unconfirmedDraftStep } from "@/modules/partner-applications/draft-fields";
import { getApplicationDrafts } from "@/modules/partner-applications/drafts";
import { wizardStep } from "@/modules/partner-applications/queries";
import { portalHref } from "@/lib/subdomain";

const APPLICATION_KIND_PORTAL: Record<ApplicationKind, Parameters<typeof portalHref>[0]> = {
  agency: "agent",
  hotel_partner: "partner",
  affiliate: "affiliate",
  venue_partner: "venue",
};

/**
 * Where "Open <portal>" should point from this page, which is served on the
 * root host. Every portal now lives on its own origin once subdomains are
 * configured, and proxy.ts 404s each portal's path tree on the root host —
 * so the config's relative path is wrong exactly when subdomains are on.
 */
function openPortalHref(kind: ApplicationKind): string {
  return portalHref(APPLICATION_KIND_PORTAL[kind]);
}

type Status = "none" | "draft" | "pending" | "under_review" | "more_info_requested" | "rejected" | "approved";

type LatestApp = Awaited<ReturnType<typeof getLatestApplication>>;

const STATUS_LABEL: Record<string, string> = {
  draft: "In progress",
  pending: "Submitted",
  under_review: "Under review",
  more_info_requested: "Action needed",
  rejected: "Not approved",
  approved: "Approved",
};

const STATUS_VARIANT: Partial<Record<string, BadgeVariant>> = {
  under_review: "info",
  more_info_requested: "destructive",
  rejected: "neutral",
};

function StatusPill({ status }: { status: string }) {
  return <Badge variant={statusBadgeVariant(status, STATUS_VARIANT)}>{STATUS_LABEL[status] ?? status}</Badge>;
}

function RecentApplicationsSection({
  applications,
  rejectedDocKeys,
}: {
  applications: RecentApplication[];
  rejectedDocKeys: Record<string, string[]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent applications</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {applications.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>No applications</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {applications.map((app) => {
              const cfg = APP_CONFIG[app.kind];
              const editable = canApplicantEdit(app.status, app.submitted_at);
              const editLabel = "Continue application";
              const adminMessage = app.status === "more_info_requested" ? app.review_notes : null;
              const rejectedKeys = rejectedDocKeys[app.id] ?? [];
              const slotLabels = new Map(docSlotsFor(app.kind).map((slot) => [slot.key, slot.label]));
              const needsAction = app.status === "more_info_requested" || rejectedKeys.length > 0;
              const href = editable ? `/account/become/${app.kind}/${app.id}` : `/account/become/${app.kind}/${app.id}/view`;
              const label = editable ? editLabel : "View";

              return (
                <li key={app.id} className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {cfg.label}
                      <StatusPill status={app.status} />
                    </p>
                    <p className="truncate text-sm text-muted-foreground tabular-nums">
                      {[
                        app.name,
                        app.reference_number,
                        app.submitted_at ? format(new Date(app.submitted_at), "d MMM yyyy") : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {adminMessage ? (
                      <p className="flex items-start gap-1.5 text-sm text-destructive">
                        <MessageSquareWarning className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {adminMessage}
                      </p>
                    ) : null}
                    {rejectedKeys.length > 0 ? (
                      <p className="flex items-start gap-1.5 text-sm text-destructive">
                        <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        Documents requiring review: {rejectedKeys.map((key) => slotLabels.get(key) ?? key).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant={needsAction ? "default" : "outline"}
                    className="self-start"
                    render={<Link href={href} />}
                  >
                    {label} <ArrowUpRight className="size-4" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function cooldownEndsAt(reviewedAt: string | null): Date | null {
  if (!reviewedAt) return null;
  return new Date(new Date(reviewedAt).getTime() + REJECT_COOLDOWN_DAYS * 86_400_000);
}

/** One program's state: what it is, where the applicant stands, and the one next action. */
function PanelRow({
  title,
  status,
  meta,
  action,
}: {
  title: string;
  status?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1">
        <h2 className="flex flex-wrap items-center gap-2 font-heading text-base font-semibold">
          {title}
          {status}
        </h2>
        {meta ? <p className="text-sm text-muted-foreground tabular-nums">{meta}</p> : null}
      </div>
      {action ? <div className="shrink-0 max-sm:[&>*]:w-full max-sm:[&_button]:w-full">{action}</div> : null}
    </div>
  );
}

function StartForm({ kind, label }: { kind: ApplicationKind; label: string }) {
  return (
    <form action={startApplication}>
      <input type="hidden" name="kind" value={kind} />
      <SubmitButton pendingText="Starting…">{label}</SubmitButton>
    </form>
  );
}

function ProgramPanel({
  kind,
  app,
  isMember,
  isApproved,
  now,
}: {
  kind: ApplicationKind;
  app: LatestApp;
  isMember: boolean;
  isApproved: boolean;
  now: number;
}) {
  const cfg = APP_CONFIG[kind];
  const status: Status = isMember || isApproved ? "approved" : ((app?.status as Status) ?? "none");
  const reference = app?.reference_number ? <span className="font-mono">{app.reference_number}</span> : null;

  if (status === "approved") {
    return (
      <PanelRow
        title={cfg.label}
        status={
          <Badge variant="success">
            <CheckCircle2 aria-hidden="true" /> Approved
          </Badge>
        }
        action={
          // Plain <a> — the agent target is a different origin, which a
          // client-side <Link> push cannot cross.
          <Button render={<a href={openPortalHref(kind)} />}>Open {cfg.portalLabel}</Button>
        }
      />
    );
  }

  if (status === "pending" || status === "under_review") {
    return <PanelRow title={cfg.label} status={<StatusPill status={status} />} meta={reference} action={app ? <Button variant="outline" render={<Link href={`/account/become/${kind}/${app.id}/view`} />}>View application <ArrowUpRight className="size-4" /></Button> : null} />;
  }

  if (status === "draft" || status === "more_info_requested") {
    return (
      <div className="space-y-4">
        <PanelRow
          title={cfg.label}
          status={<StatusPill status={status} />}
          meta={reference}
          action={
            <Button render={<Link href={canApplicantEdit(status, app?.submitted_at ?? null) ? `/account/become/${kind}/${app!.id}` : `/account/become/${kind}/${app!.id}/view`} />}>
              {canApplicantEdit(status, app?.submitted_at ?? null) ? "Continue application" : "View application"}
            </Button>
          }
        />
        {status === "more_info_requested" && app?.review_notes ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Message from STS</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{app.review_notes}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  }

  if (status === "rejected") {
    const cooldownEnd = cooldownEndsAt(app?.reviewed_at ?? null);
    const inCooldown = cooldownEnd ? now < cooldownEnd.getTime() : false;

    return (
      <div className="space-y-4">
        <PanelRow
          title={cfg.label}
          status={<StatusPill status="rejected" />}
          meta={
            inCooldown ? (
              <>Reapply from {cooldownEnd!.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
            ) : (
              reference
            )
          }
          action={inCooldown ? null : <StartForm kind={kind} label="Start new application" />}
        />
        {app?.review_notes ? (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Message from STS</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{app.review_notes}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  }

  return <PanelRow title={cfg.label} action={<StartForm kind={kind} label="Start application" />} />;
}

const VALID_PROGRAMS = ["agent", "partner", "venue", "affiliate"] as const;
const TAB_TO_KIND: Record<(typeof VALID_PROGRAMS)[number], ApplicationKind> = {
  agent: "agency",
  partner: "hotel_partner",
  venue: "venue_partner",
  affiliate: "affiliate",
};

export default async function BecomePartnerPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; submitted?: string; cooldown?: string; error?: string }>;
}) {
  const { program, submitted, cooldown, error } = await searchParams;
  const requestedTab = VALID_PROGRAMS.includes(program as (typeof VALID_PROGRAMS)[number])
    ? (program as (typeof VALID_PROGRAMS)[number])
    : null;

  const profile = await requireUser();
  const supabase = await createClient();
  const now = new Date().getTime();

  const [agencyMember, hotelPartnerMember, venuePartnerMember, affiliate, agencyApp, hotelApp, venueApp, affiliateApp, recentApplications, rejectedDocKeys] = await Promise.all([
    supabase.from("agency_members").select("agency_id").eq("profile_id", profile.id).eq("status", "active").maybeSingle(),
    supabase
      .from("hotel_partner_members")
      .select("partner_id")
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("venue_partner_members")
      .select("partner_id")
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("affiliates").select("id").eq("profile_id", profile.id).maybeSingle(),
    getLatestApplication("agency", profile.id),
    getLatestApplication("hotel_partner", profile.id),
    getLatestApplication("venue_partner", profile.id),
    getLatestApplication("affiliate", profile.id),
    getRecentApplications(profile.id),
    getRejectedDocumentKeys(),
  ]);

  // An explicit ?program= always wins. Otherwise open on whichever program STS
  // is waiting on the applicant for — landing on a default tab while the
  // request sits unread behind another one is how it gets missed.
  const needsActionTab = (Object.keys(TAB_TO_KIND) as Array<keyof typeof TAB_TO_KIND>).find((tab) =>
    recentApplications.some((app) => app.kind === TAB_TO_KIND[tab] && app.status === "more_info_requested")
  );
  const defaultTab = requestedTab ?? needsActionTab ?? "agent";

  const programs = [
    { tab: "agent", label: "Travel agent", app: agencyApp, isMember: !!agencyMember.data },
    { tab: "partner", label: "Hotel partner", app: hotelApp, isMember: !!hotelPartnerMember.data },
    { tab: "venue", label: "Event venue", app: venueApp, isMember: !!venuePartnerMember.data },
    { tab: "affiliate", label: "Affiliate", app: affiliateApp, isMember: !!affiliate.data },
  ] as const;

  const inProgress = await Promise.all(programs.filter(p=>p.app && canApplicantEdit(p.app.status,p.app.submitted_at)).map(async p=>{
    const kind=TAB_TO_KIND[p.tab];
    const app=p.app!;
    const drafts=await getApplicationDrafts(kind,app.id);
    const latest=[...drafts].sort((a,b)=>Date.parse(b.saved_at)-Date.parse(a.saved_at))[0];
    const maxStep=wizardStep(app.business_details);
    const unfinished=unconfirmedDraftStep(drafts);
    return {kind,id:app.id,maxStep,serverStep:unfinished && unfinished<=maxStep?unfinished:maxStep,savedAt:latest?Date.parse(latest.saved_at):null};
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader title="Partner applications" />
      <div className="grid gap-4 sm:grid-cols-3">{[
        {label:"Partner programs",value:programs.length,icon:FileText},
        {label:"Under review",value:programs.filter(program=>program.app && ["pending","under_review"].includes(program.app.status)).length,icon:Clock3},
        {label:"Action needed",value:programs.filter(program=>program.app && (program.app.status==="more_info_requested" || (rejectedDocKeys[program.app.id]?.length ?? 0)>0)).length,icon:MessageSquareWarning},
      ].map(metric=><Card key={metric.label} className="flex-row items-center gap-4 p-5"><span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><metric.icon className="size-6" aria-hidden /></span><div><div className="text-sm text-muted-foreground">{metric.label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{metric.value}</div></div></Card>)}</div>

      {submitted ? (
        <Alert>
          <CheckCircle2 className="text-primary" />
          <AlertTitle>Application submitted</AlertTitle>
          <AlertDescription>
            Reference <span className="font-mono font-medium text-foreground">{submitted}</span>
          </AlertDescription>
        </Alert>
      ) : null}
      {cooldown ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>The reapplication period has not ended yet.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>Could not start the application. Try again.</AlertDescription>
        </Alert>
      ) : null}

      {inProgress.length>0 && <section aria-labelledby="drafts-title" className="space-y-4"><div className="flex items-center gap-3"><h2 id="drafts-title" className="text-lg font-semibold">In progress</h2><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{inProgress.length}</span></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{inProgress.map(d=><DraftProgressCard key={d.id} {...d} owner={profile.id}/>)}</div></section>}
      <Tabs defaultValue={defaultTab}>
        <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-3 bg-transparent p-0 lg:grid-cols-4">
            {programs.map((p) => (
              <TabsTrigger key={p.tab} value={p.tab} className="h-auto min-h-24 justify-start gap-3 rounded-xl border border-border bg-card px-4 py-5 text-left shadow-none data-active:border-primary data-active:bg-primary/5">
                {p.tab === "agent" ? <Plane className="size-6 text-primary" /> : p.tab === "partner" ? <Building2 className="size-6 text-primary" /> : p.tab === "venue" ? <CalendarDays className="size-6 text-primary" /> : <Handshake className="size-6 text-primary" />}
                <span className="flex min-w-0 flex-col items-start gap-2"><span className="font-semibold">{p.label}</span><span className="text-xs text-muted-foreground">{p.isMember ? "Workspace available" : p.app ? (STATUS_LABEL[p.app.status] ?? p.app.status) : "Start application"}</span></span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {programs.map((p) => (
          <TabsContent key={p.tab} value={p.tab} className="mt-5">
            <Card className="border-primary/20 bg-primary/[0.025]">
              <CardContent className="p-5 sm:p-6">
                <ProgramPanel kind={TAB_TO_KIND[p.tab]} app={p.app} isMember={p.isMember} isApproved={false} now={now} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <RecentApplicationsSection applications={recentApplications} rejectedDocKeys={rejectedDocKeys} />
    </div>
  );
}
