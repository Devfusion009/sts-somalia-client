import type { Metadata } from "next";
import { format } from "date-fns";
import { Monitor, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import {
  ChangePasswordCard,
  DeleteAccountCard,
  SignOutEverywhereButton,
} from "@/modules/auth/components/security-panels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Security" };

/** Turns a raw user-agent into something a person can recognise their own device by. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const os = /Windows/i.test(userAgent)
    ? "Windows"
    : /iPhone|iPad|iOS/i.test(userAgent)
      ? "iOS"
      : /Android/i.test(userAgent)
        ? "Android"
        : /Mac OS X|Macintosh/i.test(userAgent)
          ? "macOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Unknown OS";

  // Order matters: Edge and Chrome both claim "Safari", and Chrome claims
  // "Safari" too, so the most specific token has to be tested first.
  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /OPR\//i.test(userAgent)
      ? "Opera"
      : /Chrome\//i.test(userAgent)
        ? "Chrome"
        : /Firefox\//i.test(userAgent)
          ? "Firefox"
          : /Safari\//i.test(userAgent)
            ? "Safari"
            : "Unknown browser";

  return `${browser} on ${os}`;
}

export default async function AccountSecurityPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  const [factors, loginsRes, deletionRes] = await Promise.all([
    listVerifiedFactors(),
    supabase
      .from("login_events")
      .select("id, portal, ip_address, user_agent, created_at")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("account_deletion_requests")
      .select("id, status, created_at")
      .eq("profile_id", profile.id)
      .in("status", ["requested", "in_review"])
      .maybeSingle(),
  ]);

  const logins = loginsRes.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Security</h1>
        <p className="text-sm text-muted-foreground">
          Manage how you sign in to your STS account.
        </p>
      </div>

      <ChangePasswordCard />

      <MfaSettings
        factors={factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null }))}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="size-5 text-muted-foreground" /> Recent sign-ins
              </CardTitle>
              <CardDescription>
                The last 10 times this account was signed into. If you don&apos;t recognise one,
                change your password and sign out everywhere.
              </CardDescription>
            </div>
            <SignOutEverywhereButton />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logins.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No sign-ins recorded yet. This list starts filling from your next sign-in.
            </p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {logins.map((login, index) => (
                <li
                  key={login.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{describeDevice(login.user_agent)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(login.created_at), "d MMM yyyy, HH:mm")}
                      {login.ip_address ? ` · ${login.ip_address}` : ""}
                      {login.portal ? ` · ${login.portal}` : ""}
                    </p>
                  </div>
                  {index === 0 ? <Badge variant="secondary">Most recent</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-muted-foreground" /> Keeping your account safe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            STS will never ask for your password, your mobile-money PIN, or a two-factor code by
            phone, WhatsApp or email. Anyone who does is not us.
          </p>
          <p>
            Your passport scans and travel documents stay private to your account — staff only see a
            document once you attach it to a specific application.
          </p>
        </CardContent>
      </Card>

      <DeleteAccountCard openRequest={deletionRes.data ?? null} />
    </div>
  );
}
