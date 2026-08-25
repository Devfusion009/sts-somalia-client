import Link from "next/link";
import { LayoutDashboard, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyPartnerContexts } from "@/modules/identity/queries";
import { portalHref } from "@/lib/subdomain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  const totalBookings = (hotelCount ?? 0) + (flightCount ?? 0) + (visaCount ?? 0) + (umrahCount ?? 0);
  const contexts = await getMyPartnerContexts(profile.id, profile.full_name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
      </div>

      {/* Above the fold, before the stat cards. An expiring passport is the
          one thing on this page that has a deadline attached to it — burying
          it under the booking counts would be filing it, not warning about it. */}
      <PassportExpiryAlert expiry={selfTraveler?.passport_expiry} subject="Your passport" />

      {profile.is_platform_admin ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="font-medium">You have access to the Admin Console</p>
                <p className="text-sm text-muted-foreground">Manage the platform from there.</p>
              </div>
            </div>
            <Button render={<Link href={portalHref("admin")} />}>Open Admin Console</Button>
          </CardContent>
        </Card>
      ) : null}

      {contexts.map((c) => (
        <Card key={c.type} className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LayoutDashboard className="size-5" />
              </span>
              <div>
                <p className="font-medium">
                  You have access to {c.name}
                  {c.status && c.status !== "live" ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground capitalize">({c.status})</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {c.label} — manage bookings, listings, or your team from there.
                </p>
              </div>
            </div>
            <Button render={<Link href={c.href} />}>Open {c.label}</Button>
          </CardContent>
        </Card>
      ))}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Hotel bookings" value={hotelCount ?? 0} />
        <StatCard label="Flight bookings" value={flightCount ?? 0} />
        <StatCard label="Visa applications" value={visaCount ?? 0} />
        <StatCard label="Umrah bookings" value={umrahCount ?? 0} />
      </div>

      {totalBookings > 0 ? (
        <p className="text-sm text-muted-foreground">
          See all of them on the{" "}
          <Link href="/account/bookings" className="font-medium text-primary hover:underline">
            My Bookings
          </Link>{" "}
          page.
        </p>
      ) : null}

      <ProfileForm profile={profile} />
      <TravelerProfileCard traveler={selfTraveler} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}
