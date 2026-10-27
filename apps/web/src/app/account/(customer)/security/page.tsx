import type { Metadata } from "next";
import { format, formatDistanceToNow } from "date-fns";
import {
  KeyRound,
  LogIn,
  LogOut,
  Monitor,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { countUnusedRecoveryCodes } from "@/lib/auth/recovery-codes";
import { describeDevice, describeLocation } from "@/lib/auth/device";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import {
  ChangePasswordCard,
  DeleteAccountCard,
  RevokeSessionButton,
  SignOutEverywhereButton,
  SignOutOthersButton,
} from "@/modules/auth/components/security-panels";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Security" };

const EVENT_LABEL: Record<string, { label: string; icon: LucideIcon }> = {
  sign_in: { label: "Signed in", icon: LogIn },
  password_changed: { label: "Password changed", icon: KeyRound },
  mfa_enabled: { label: "Two-factor turned on", icon: ShieldCheck },
  mfa_disabled: { label: "Two-factor turned off", icon: ShieldOff },
  recovery_codes_generated: { label: "New recovery codes", icon: KeyRound },
  recovery_code_used: { label: "Recovery code used", icon: KeyRound },
  signed_out_others: { label: "Signed out other devices", icon: LogOut },
  session_revoked: { label: "Signed out a device", icon: LogOut },
};

const PORTAL_LABEL: Record<string, string> = {
  agent: "Agent portal",
  admin: "Admin console",
  manager: "Manager portal",
  affiliate: "Affiliate portal",
  partner: "Partner portal",
  hotel_partner: "Partner portal",
  venue: "Venue portal",
  venue_partner: "Venue portal",
};

function isMobile(userAgent: string | null) {
  return Boolean(userAgent && /iPhone|iPad|Android|Mobile/i.test(userAgent));
}

export default async function AccountSecurityPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  const [factors, recoveryCodesLeft, claimsRes, sessionsRes, activityRes, deletionRes] = await Promise.all([
    listVerifiedFactors(),
    countUnusedRecoveryCodes(profile.id).catch(() => 0),
    supabase.auth.getClaims(),
    supabase.rpc("my_auth_sessions"),
    supabase
      .from("login_events")
      .select("id, event, portal, ip_address, user_agent, city, country, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("account_deletion_requests")
      .select("id, status, created_at")
      .eq("profile_id", profile.id)
      .in("status", ["requested", "in_review"])
      .maybeSingle(),
  ]);

  const currentSessionId =
    typeof claimsRes.data?.claims.session_id === "string" ? claimsRes.data.claims.session_id : null;
  const sessions = [...(sessionsRes.data ?? [])].sort(
    (a, b) => Number(b.id === currentSessionId) - Number(a.id === currentSessionId)
  );
  const activity = activityRes.data ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Security" />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ChangePasswordCard />
        <MfaSettings
          factors={factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null, created_at: f.created_at }))}
          recoveryCodesLeft={recoveryCodesLeft}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Where you&apos;re signed in</CardTitle>
          <CardAction className="flex flex-wrap items-center gap-2">
            <SignOutOthersButton disabled={sessions.length < 2} />
            <SignOutEverywhereButton />
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {sessions.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Monitor />
                </EmptyMedia>
                <EmptyTitle>No active sessions</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {sessions.map((session) => {
                const device = describeDevice(session.user_agent);
                const isCurrent = session.id === currentSessionId;
                const lastActive = new Date(session.last_active_at);
                const activeNow = session.active_recently;
                const DeviceIcon = isMobile(session.user_agent) ? Smartphone : Monitor;
                return (
                  <li key={session.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <DeviceIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {device}
                        {isCurrent ? <Badge variant="success">This device</Badge> : null}
                        {session.aal === "aal2" ? <Badge variant="secondary">2FA</Badge> : null}
                      </p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {isCurrent || activeNow ? "Active now" : `Last active ${formatDistanceToNow(lastActive, { addSuffix: true })}`}
                        {session.ip ? ` · ${session.ip}` : ""}
                        {` · Signed in ${format(new Date(session.created_at), "d MMM yyyy")}`}
                      </p>
                    </div>
                    {isCurrent ? null : <RevokeSessionButton sessionId={session.id} device={device} />}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {activity.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LogIn />
                </EmptyMedia>
                <EmptyTitle>No activity recorded</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {activity.map((item) => {
                const meta = EVENT_LABEL[item.event] ?? EVENT_LABEL.sign_in;
                const Icon = meta.icon;
                const location = describeLocation(item.city, item.country);
                const portal = item.event === "sign_in" && item.portal ? PORTAL_LABEL[item.portal] : undefined;
                return (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {meta.label}
                        {portal ? <span className="font-normal text-muted-foreground"> · {portal}</span> : null}
                      </p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {format(new Date(item.created_at), "d MMM yyyy, HH:mm")}
                        {` · ${describeDevice(item.user_agent)}`}
                        {location ? ` · ${location}` : ""}
                        {item.ip_address ? ` · ${String(item.ip_address)}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <DeleteAccountCard openRequest={deletionRes.data ?? null} />
    </div>
  );
}
