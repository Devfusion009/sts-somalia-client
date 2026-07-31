import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AgencyApplicationForm,
  AffiliateApplicationForm,
  HotelPartnerApplicationForm,
} from "./application-forms";

type Status = "none" | "pending" | "rejected" | "approved";

function StatusBanner({ status, portalHref, portalLabel }: { status: Status; portalHref: string; portalLabel: string }) {
  if (status === "approved") {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-primary" /> You&apos;re approved.
          </div>
          <Button size="sm" render={<Link href={portalHref} />}>
            Open {portalLabel}
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (status === "pending") {
    return (
      <Alert>
        <Clock />
        <AlertDescription>Your application is under review. We&apos;ll notify you once it&apos;s decided.</AlertDescription>
      </Alert>
    );
  }
  if (status === "rejected") {
    return (
      <Alert variant="destructive">
        <XCircle />
        <AlertDescription>Your previous application wasn&apos;t approved. You can submit a new one below.</AlertDescription>
      </Alert>
    );
  }
  return null;
}

export default async function BecomePartnerPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  const [agencyMember, hotelPartnerMember, affiliate, agencyApp, partnerApp, affiliateApp] = await Promise.all([
    supabase.from("agency_members").select("agency_id").eq("profile_id", profile.id).eq("status", "active").maybeSingle(),
    supabase
      .from("hotel_partner_members")
      .select("partner_id")
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("affiliates").select("id").eq("profile_id", profile.id).maybeSingle(),
    supabase
      .from("agency_applications")
      .select("status")
      .eq("applicant_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("hotel_partner_applications")
      .select("status")
      .eq("applicant_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("affiliate_applications")
      .select("status")
      .eq("applicant_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const agencyStatus: Status = agencyMember.data ? "approved" : (agencyApp.data?.status ?? "none");
  const partnerStatus: Status = hotelPartnerMember.data ? "approved" : (partnerApp.data?.status ?? "none");
  const affiliateStatus: Status = affiliate.data ? "approved" : (affiliateApp.data?.status ?? "none");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Become a Partner</h1>
        <p className="text-sm text-muted-foreground">Apply to join STS Somalia as an agent, hotel partner, or affiliate.</p>
      </div>

      <Tabs defaultValue="agent">
        <TabsList>
          <TabsTrigger value="agent">Travel Agent</TabsTrigger>
          <TabsTrigger value="partner">Hotel Partner</TabsTrigger>
          <TabsTrigger value="affiliate">Affiliate</TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Travel Agent</CardTitle>
              <CardDescription>Access B2B rates and book on behalf of your customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusBanner status={agencyStatus} portalHref="/agent" portalLabel="Agent Portal" />
              {agencyStatus === "none" || agencyStatus === "rejected" ? <AgencyApplicationForm /> : null}
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
              <StatusBanner status={partnerStatus} portalHref="/partner" portalLabel="Partner Portal" />
              {partnerStatus === "none" || partnerStatus === "rejected" ? <HotelPartnerApplicationForm /> : null}
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
              <StatusBanner status={affiliateStatus} portalHref="/affiliate" portalLabel="Affiliate Dashboard" />
              {affiliateStatus === "none" || affiliateStatus === "rejected" ? <AffiliateApplicationForm /> : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
