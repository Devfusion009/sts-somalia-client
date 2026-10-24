import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { portalHref } from "@/lib/subdomain";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getServerTrpc } from "@/lib/trpc/server";
import { TravelerProfileCard } from "@/modules/travelers/components/traveler-profile-card";
import { PassportExpiryAlert } from "@/modules/travelers/components/passport-alert";
import { ProfileForm } from "./profile-form";

export default async function AccountOverviewPage() {
  const profile = await requireUser();
  const supabase = await createClient();
  const trpc = await getServerTrpc();
  // apps/api is a separate deployment (not yet reachable from every
  // environment) — the rest of the overview page has nothing to do with
  // traveler details, so it shouldn't 500 just because that one dependency
  // is down.
  const selfTraveler = await trpc.travelers.selfTraveler.query().catch(() => null);

  const [{ count: hotelCount }, { count: flightCount }, { count: visaCount }, { count: umrahCount }] =
    await Promise.all([
      supabase
        .from("hotel_bookings")
        .select("*", { count: "exact", head: true })
        .or(`customer_id.eq.${profile.id},booked_by.eq.${profile.id}`),
      supabase
        .from("flight_bookings")
        .select("*", { count: "exact", head: true })
        .or(`customer_id.eq.${profile.id},booked_by.eq.${profile.id}`),
      supabase
        .from("visa_applications")
        .select("*", { count: "exact", head: true })
        .or(`applicant_profile_id.eq.${profile.id},submitted_by.eq.${profile.id}`),
      supabase
        .from("umrah_bookings")
        .select("*", { count: "exact", head: true })
        .or(`customer_id.eq.${profile.id},booked_by.eq.${profile.id}`),
    ]);

  const contexts = await getMyPartnerContexts(profile.id, profile.full_name);

  const workspaces = [
    ...(profile.is_platform_admin
      ? [{ key: "admin", name: "Admin Console", meta: "STS staff", status: null, href: portalHref("admin") }]
      : []),
    ...contexts.map((c) => ({
      key: c.type,
      name: c.name,
      meta: c.label,
      status: c.status && c.status !== "live" ? c.status : null,
      href: c.href,
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Overview" meta={profile.email} />

      {/* Above the fold, before the stat rail. An expiring passport is the
          one thing on this page that has a deadline attached to it — burying
          it under the booking counts would be filing it, not warning about it. */}
      <PassportExpiryAlert expiry={selfTraveler?.passport_expiry} subject="Your passport" />

      {workspaces.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border border-t border-border">
              {workspaces.map((w) => (
                <li key={w.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{w.name}</span>
                      {w.status ? (
                        <Badge variant={statusBadgeVariant(w.status)} className="capitalize">
                          {w.status.replace(/_/g, " ")}
                        </Badge>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{w.meta}</p>
                  </div>
                  <Button variant="outline" render={<Link href={w.href} />}>
                    Open <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <StatRail>
        <StatRailItem label="Hotel bookings" value={hotelCount ?? 0} />
        <StatRailItem label="Flight bookings" value={flightCount ?? 0} />
        <StatRailItem label="Visa applications" value={visaCount ?? 0} />
        <StatRailItem label="Umrah bookings" value={umrahCount ?? 0} />
      </StatRail>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ProfileForm profile={profile} />
        </div>
        <div className="lg:col-span-3">
          <TravelerProfileCard traveler={selfTraveler} />
        </div>
      </div>
    </div>
  );
}
