import type { Metadata } from "next";
import { format } from "date-fns";
import { Monitor } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import {
  ChangePasswordCard,
  DeleteAccountCard,
  SignOutEverywhereButton,
} from "@/modules/auth/components/security-panels";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Security" />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ChangePasswordCard />
        <MfaSettings
          factors={factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent sign-ins</CardTitle>
          <CardAction>
            <SignOutEverywhereButton />
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {logins.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Monitor />
                </EmptyMedia>
                <EmptyTitle>No sign-ins recorded</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {logins.map((login, index) => (
                <li
                  key={login.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{describeDevice(login.user_agent)}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {format(new Date(login.created_at), "d MMM yyyy, HH:mm")}
                      {login.ip_address ? ` · ${login.ip_address}` : ""}
                      {login.portal ? <span className="capitalize">{` · ${login.portal}`}</span> : null}
                    </p>
                  </div>
                  {index === 0 ? <Badge variant="secondary">Most recent</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DeleteAccountCard openRequest={deletionRes.data ?? null} />
    </div>
  );
}
