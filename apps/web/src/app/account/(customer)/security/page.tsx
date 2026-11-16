import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity, ArrowRight, Check, ChevronRight, Clock3, KeyRound, Lightbulb,
  LogIn, LogOut, Monitor, ShieldCheck, ShieldOff, Smartphone, type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { countUnusedRecoveryCodes } from "@/lib/auth/recovery-codes";
import { describeDevice, describeLocation } from "@/lib/auth/device";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import {
  ChangePasswordCard, DeleteAccountCard, RevokeSessionButton,
  SignOutEverywhereButton, SignOutOthersButton,
} from "@/modules/auth/components/security-panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Security" };

const EVENT_LABEL: Record<string, { label: string; icon: LucideIcon }> = {
  sign_in: { label: "Signed in", icon: LogIn },
  password_changed: { label: "Password changed", icon: KeyRound },
  mfa_enabled: { label: "Two-factor enabled", icon: ShieldCheck },
  mfa_disabled: { label: "Two-factor disabled", icon: ShieldOff },
  recovery_codes_generated: { label: "Recovery codes generated", icon: KeyRound },
  recovery_code_used: { label: "Recovery code used", icon: KeyRound },
  signed_out_others: { label: "Other devices signed out", icon: LogOut },
  session_revoked: { label: "Device signed out", icon: LogOut },
};
const PORTAL_LABEL: Record<string, string> = {
  agent: "Agent portal", admin: "Admin console", manager: "Manager portal",
  affiliate: "Affiliate portal", partner: "Partner portal", hotel_partner: "Partner portal",
  venue: "Venue portal", venue_partner: "Venue portal",
};
const ACTIVITY_PAGE_SIZE = 6;

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>;
}

function deviceLabel(userAgent: string | null) {
  const label = describeDevice(userAgent);
  return label === "Unknown browser on Unknown OS" ? "Browser session" : label;
}

export default async function AccountSecurityPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;
  const rawPage = Array.isArray(params.activityPage) ? params.activityPage[0] : params.activityPage;
  const parsedPage = Number(rawPage ?? 1);
  let activityPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;
  const loadActivity = (page: number) => supabase.from("login_events")
    .select("id, event, portal, ip_address, user_agent, city, country, created_at", { count: "exact" })
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * ACTIVITY_PAGE_SIZE, page * ACTIVITY_PAGE_SIZE - 1);

  const [factorsRes, recoveryCodesLeft, claimsRes, sessionsRes, initialActivity, activityCountRes, passwordRes, deletionRes, requestHeaders] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    countUnusedRecoveryCodes(profile.id).catch(() => null),
    supabase.auth.getClaims(),
    supabase.rpc("my_auth_sessions"),
    loadActivity(activityPage),
    supabase.from("login_events").select("id", { count: "exact", head: true })
      // eslint-disable-next-line react-hooks/purity -- This server query uses the request time for its seven-day window.
      .eq("profile_id", profile.id).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from("login_events").select("created_at")
      .eq("profile_id", profile.id).eq("event", "password_changed")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("account_deletion_requests").select("id, status, created_at")
      .eq("profile_id", profile.id).in("status", ["requested", "in_review"]).maybeSingle(),
    headers(),
  ]);

  let activityRes = initialActivity;
  const activityPages = Math.max(1, Math.ceil((activityRes.count ?? 0) / ACTIVITY_PAGE_SIZE));
  if (!activityRes.error && activityPage > activityPages) {
    activityPage = activityPages;
    activityRes = await loadActivity(activityPage);
  }
  const activityHref = (page: number) => `/account/security?activityPage=${page}#security-activity`;
  const factors = factorsRes.data?.totp.filter(factor => factor.status === "verified") ?? [];
  const currentSessionId = !claimsRes.error && typeof claimsRes.data?.claims.session_id === "string" ? claimsRes.data.claims.session_id : null;
  const sessions = [...(sessionsRes.data ?? [])].sort((a, b) => Number(b.id === currentSessionId) - Number(a.id === currentSessionId));
  const activity = activityRes.data ?? [];
  const lastPasswordChange = !passwordRes.error ? passwordRes.data?.created_at : null;
  const summary = [
    { label: "Password", value: "Manage password", icon: KeyRound, href: "#password-signin", fact: lastPasswordChange ? `Changed ${format(new Date(lastPasswordChange), "d MMM yyyy")}` : null },
    { label: "Two-factor authentication", value: factorsRes.error ? "Unavailable" : factors.length ? "Enabled" : "Not enabled", icon: ShieldCheck, href: "#two-factor", fact: !factorsRes.error && factors.length ? `${factors.length} authenticator${factors.length === 1 ? "" : "s"}` : null },
    { label: "Active sessions", value: sessionsRes.error ? "Unavailable" : sessions.length >= 50 ? "50+" : sessions.length, icon: Monitor, href: "#active-sessions", fact: null },
    { label: "Security activity", value: activityCountRes.error ? "Unavailable" : `${activityCountRes.count ?? 0} events`, icon: Activity, href: "#security-activity", fact: "Last 7 days" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="size-7" aria-hidden /></span>
        <PageHeader title="Security" />
      </div>

      <nav aria-label="Security overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(item => <Link key={item.label} href={item.href} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Card className="h-full flex-row items-start gap-3 p-4 transition-colors group-hover:bg-primary/[0.035]">
            <IconTile icon={item.icon} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
              <div className="mt-2 text-base font-semibold tabular-nums">{item.value}</div>
              {item.fact ? <div className="mt-1 text-xs text-muted-foreground">{item.fact}</div> : null}
            </div>
            <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Card>
        </Link>)}
      </nav>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ChangePasswordCard dashboard />
        {factorsRes.error ? (
          <Card id="two-factor" className="scroll-mt-20">
            <CardHeader><CardTitle className="flex items-center gap-3"><IconTile icon={ShieldCheck} />Two-factor authentication</CardTitle></CardHeader>
            <CardContent><p role="status" className="text-sm text-muted-foreground">Authenticator settings could not be loaded.</p></CardContent>
          </Card>
        ) : <MfaSettings dashboard factors={factors.map(factor => ({ id: factor.id, friendly_name: factor.friendly_name ?? null, created_at: factor.created_at }))} recoveryCodesLeft={recoveryCodesLeft} />}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card id="active-sessions" className="scroll-mt-20">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-3"><IconTile icon={Monitor} />Where you&apos;re signed in</CardTitle>
            <div className="flex flex-wrap gap-2">
              <SignOutOthersButton disabled={Boolean(sessionsRes.error) || !currentSessionId || sessions.length < 2} />
              <SignOutEverywhereButton />
            </div>
          </CardHeader>
          <CardContent>
            {sessionsRes.error ? <p role="status" className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Sessions could not be loaded.</p> : sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No active sessions</div>
            ) : <ul className="space-y-1">
              {sessions.map(session => {
                const isCurrent = session.id === currentSessionId;
                const userAgent = session.user_agent || (isCurrent ? requestHeaders.get("user-agent") : null);
                const device = deviceLabel(userAgent);
                const DeviceIcon = /iPhone|iPad|Android|Mobile/i.test(userAgent ?? "") ? Smartphone : Monitor;
                return <li key={session.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3.5 ${isCurrent ? "border-primary/10 bg-primary/[0.06]" : "border-transparent"}`}>
                  <DeviceIcon className="size-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1 basis-44">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{device}{isCurrent ? <Badge variant="success">This device</Badge> : null}{session.aal === "aal2" ? <Badge variant="secondary">2FA</Badge> : null}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Signed in {format(new Date(session.created_at), "d MMM yyyy")}</div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden />{isCurrent || session.active_recently ? "Active now" : formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })}</div>
                    {session.ip ? <div className="font-mono text-[11px]">{session.ip}</div> : null}
                  </div>
                  {isCurrent || !currentSessionId ? null : <RevokeSessionButton sessionId={session.id} device={device} />}
                </li>;
              })}
            </ul>}
          </CardContent>
        </Card>

        <Card id="security-activity" className="scroll-mt-20">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-3"><IconTile icon={Activity} />Recent activity</CardTitle>
            {!activityRes.error ? <Badge variant="neutral">{activityRes.count ?? 0} total</Badge> : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {activityRes.error ? <p role="status" className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Security activity could not be loaded.</p> : activity.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No activity recorded</div>
            ) : <ul className="divide-y">
              {activity.map(item => {
                const meta = EVENT_LABEL[item.event] ?? { label: "Account activity", icon: Activity };
                const Icon = meta.icon;
                const location = describeLocation(item.city, item.country);
                const portal = item.event === "sign_in" && item.portal ? PORTAL_LABEL[item.portal] : undefined;
                return <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${item.event === "mfa_disabled" || item.event === "recovery_code_used" ? "bg-amber-500/10 text-amber-700" : "bg-primary/10 text-primary"}`}><Icon className="size-4" aria-hidden /></span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap justify-between gap-x-2 gap-y-1">
                      <span className="text-xs font-semibold">{meta.label}</span>
                      <time dateTime={item.created_at} className="text-[11px] text-muted-foreground tabular-nums">{format(new Date(item.created_at), "d MMM, HH:mm")}</time>
                    </div>
                    <div className="text-xs text-muted-foreground">{deviceLabel(item.user_agent)}{location ? ` · ${location}` : ""}{portal ? ` · ${portal}` : ""}</div>
                    {item.ip_address ? <div className="font-mono text-[11px] text-muted-foreground">{String(item.ip_address)}</div> : null}
                  </div>
                </li>;
              })}
            </ul>}
            {!activityRes.error && activityPages > 1 ? <nav aria-label="Security activity pages" className="flex items-center justify-between gap-2 border-t pt-3">
              <Button size="sm" variant="outline" disabled={activityPage === 1} render={activityPage > 1 ? <Link href={activityHref(activityPage - 1)} /> : undefined}>Previous</Button>
              <span className="text-xs text-muted-foreground tabular-nums">{activityPage} of {activityPages}</span>
              <Button size="sm" variant="outline" disabled={activityPage === activityPages} render={activityPage < activityPages ? <Link href={activityHref(activityPage + 1)} /> : undefined}>Next <ArrowRight className="size-3.5" aria-hidden /></Button>
            </nav> : null}
          </CardContent>
        </Card>
      </div>

      <Card className="flex-row flex-wrap items-center gap-x-8 gap-y-4 p-5">
        <div className="flex items-center gap-3 font-semibold"><IconTile icon={Lightbulb} />Account protection</div>
        <ul className="flex flex-1 flex-wrap gap-x-8 gap-y-3 text-xs">
          {["Use a unique password", "Keep recovery codes offline", "Sign out on shared devices"].map(tip => <li key={tip} className="flex items-center gap-2"><Check className="size-4 text-primary" aria-hidden />{tip}</li>)}
        </ul>
      </Card>
      {deletionRes.error ? <Card><CardContent><p role="status" className="text-sm text-muted-foreground">Account deletion status could not be loaded.</p></CardContent></Card> : <DeleteAccountCard openRequest={deletionRes.data ?? null} />}
    </div>
  );
}
