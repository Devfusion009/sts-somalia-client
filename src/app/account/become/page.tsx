import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2, Clock, XCircle, FileEdit, PartyPopper, AlertTriangle, Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { APP_CONFIG, REJECT_COOLDOWN_DAYS, type ApplicationKind } from "@/modules/partner-applications/config";
import { getLatestApplication, getRecentApplications, type RecentApplication } from "@/modules/partner-applications/queries";
import { startApplication } from "@/modules/partner-applications/actions";
import { portalHref } from "@/lib/subdomain";

/**
 * Where "Open <portal>" should point from this page, which is served on the
 * root host. The Agent Portal lives on its own origin once subdomains are
 * configured, and proxy.ts 404s /agent/* on the root host — so the config's
 * relative "/agent" is wrong exactly when subdomains are on. Hotel Partner and
 * Affiliate have no subdomain of their own and stay relative.
 */
function openPortalHref(kind: ApplicationKind): string {
  return kind === "agency" ? portalHref("agent") : APP_CONFIG[kind].portalHref;
}

type Status = "none" | "draft" | "pending" | "under_review" | "more_info_requested" | "rejected" | "approved";

type LatestApp = Awaited<ReturnType<typeof getLatestApplication>>;

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Submitted",
  under_review: "Under review",
  more_info_requested: "Action needed",
  rejected: "Not approved",
  approved: "Approved",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-brand-gold/15 text-brand-gold",
  under_review: "bg-chart-3/10 text-chart-3",
  more_info_requested: "bg-destructive/10 text-destructive",
  rejected: "bg-muted text-muted-foreground",
  approved: "bg-primary/10 text-primary",
};

function RecentApplicationsSection({ applications }: { applications: RecentApplication[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Applications</CardTitle>
        <CardDescription>Every application you&apos;ve submitted, across all programs.</CardDescription>
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Inbox className="size-6" />
            You haven&apos;t submitted an application yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => {
                const cfg = APP_CONFIG[app.kind];
                const editable = ["draft", "more_info_requested", "pending", "under_review"].includes(app.status);
                const editLabel =
                  app.status === "draft" ? "Resume" : app.status === "more_info_requested" ? "Continue" : "Edit";
                return (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">
                      {cfg.label}
                      {app.name ? <span className="block text-xs font-normal text-muted-foreground">{app.name}</span> : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{app.reference_number ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={`border-transparent ${STATUS_BADGE_CLASS[app.status] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABEL[app.status] ?? app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.submitted_at ? format(new Date(app.submitted_at), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Button size="sm" variant="outline" render={<Link href={`/account/become/${app.kind}/${app.id}`} />}>
                          {editLabel}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" render={<Link href={`/account/become/${app.kind}/${app.id}/view`} />}>
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function cooldownEndsAt(reviewedAt: string | null): Date | null {
  if (!reviewedAt) return null;
  return new Date(new Date(reviewedAt).getTime() + REJECT_COOLDOWN_DAYS * 86_400_000);
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

  if (status === "approved") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-primary" /> You&apos;re approved.
          </div>
          {/* Plain <a> — the agent target is a different origin, which a
              client-side <Link> push cannot cross. */}
          <Button size="sm" render={<a href={openPortalHref(kind)} />}>
            Open {cfg.portalLabel}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "pending" || status === "under_review") {
    return (
      <Alert>
        <Clock />
        <AlertDescription>
          Your application {app?.reference_number ? <span className="font-mono">({app.reference_number})</span> : null} is under review.
          We&apos;ll notify you by email once it&apos;s decided.
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "draft" || status === "more_info_requested") {
    return (
      <div className="space-y-3">
        {status === "more_info_requested" ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>More information needed</AlertTitle>
            <AlertDescription>{app?.review_notes || "Please review and update your application, then resubmit."}</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <FileEdit />
            <AlertDescription>You have a draft application in progress.</AlertDescription>
          </Alert>
        )}
        <Button className="gap-1.5" render={<Link href={`/account/become/${kind}/${app!.id}`} />}>
          {status === "more_info_requested" ? "Continue Application" : "Resume Application"}
        </Button>
      </div>
    );
  }

  if (status === "rejected") {
    const cooldownEnd = cooldownEndsAt(app?.reviewed_at ?? null);
    const inCooldown = cooldownEnd ? now < cooldownEnd.getTime() : false;

    if (inCooldown) {
      return (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Application not approved</AlertTitle>
          <AlertDescription>
            {app?.review_notes ? <p className="mb-1">{app.review_notes}</p> : null}
            You can submit a new application starting {cooldownEnd!.toLocaleDateString()}.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <XCircle />
          <AlertDescription>{app?.review_notes || "Your previous application wasn't approved. You can submit a new one below."}</AlertDescription>
        </Alert>
        <form action={startApplication}>
          <input type="hidden" name="kind" value={kind} />
          <SubmitButton pendingText="Starting…">Start New Application</SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <form action={startApplication}>
      <input type="hidden" name="kind" value={kind} />
      <SubmitButton pendingText="Starting…">Start Application</SubmitButton>
    </form>
  );
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
  const defaultTab = VALID_PROGRAMS.includes(program as (typeof VALID_PROGRAMS)[number])
    ? (program as (typeof VALID_PROGRAMS)[number])
    : "agent";

  const profile = await requireUser();
  const supabase = await createClient();
  const now = new Date().getTime();

  const [agencyMember, hotelPartnerMember, venuePartnerMember, affiliate, agencyApp, hotelApp, venueApp, affiliateApp, recentApplications] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Become a Partner</h1>
        <p className="text-sm text-muted-foreground">Apply to join STS Somalia as an agent, hotel partner, or affiliate.</p>
      </div>

      {submitted ? (
        <Alert className="border-primary/30 bg-primary/5">
          <PartyPopper />
          <AlertTitle>Application submitted</AlertTitle>
          <AlertDescription>
            Your reference number is <span className="font-mono font-medium">{submitted}</span>. Save it for your records — we&apos;ll email you once
            it&apos;s reviewed.
          </AlertDescription>
        </Alert>
      ) : null}
      {cooldown ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>You recently applied and were not approved. Please wait out the reapplication period shown below before trying again.</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>Something went wrong starting your application. Please try again.</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="agent">Travel Agent</TabsTrigger>
          <TabsTrigger value="partner">Hotel Partner</TabsTrigger>
          <TabsTrigger value="venue">Event Venue</TabsTrigger>
          <TabsTrigger value="affiliate">Affiliate</TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Travel Agent</CardTitle>
              <CardDescription>Access B2B rates and book on behalf of your customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgramPanel kind={TAB_TO_KIND.agent} app={agencyApp} isMember={!!agencyMember.data} isApproved={false} now={now} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partner" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hotel Partner</CardTitle>
              <CardDescription>List your property and manage rooms and bookings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgramPanel kind={TAB_TO_KIND.partner} app={hotelApp} isMember={!!hotelPartnerMember.data} isApproved={false} now={now} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="venue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Event Venue Partner</CardTitle>
              <CardDescription>List your event hall and manage booking requests.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgramPanel kind={TAB_TO_KIND.venue} app={venueApp} isMember={!!venuePartnerMember.data} isApproved={false} now={now} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="affiliate" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Affiliate</CardTitle>
              <CardDescription>Earn commission promoting STS Somalia.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgramPanel kind={TAB_TO_KIND.affiliate} app={affiliateApp} isMember={!!affiliate.data} isApproved={false} now={now} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecentApplicationsSection applications={recentApplications} />
    </div>
  );
}
