import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { portalForRole } from "@/lib/auth/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "./profile-form";

export default async function AccountOverviewPage() {
  const profile = await requireUser();
  const supabase = await createClient();

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
  const portal = portalForRole(profile.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and see all your STS bookings in one place.</p>
      </div>

      {portal ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LayoutDashboard className="size-5" />
              </span>
              <div>
                <p className="font-medium">You have access to the {portal.label}</p>
                <p className="text-sm text-muted-foreground">Manage bookings, listings, or your team from there.</p>
              </div>
            </div>
            <Button render={<Link href={portal.href} />}>Open {portal.label}</Button>
          </CardContent>
        </Card>
      ) : null}

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
