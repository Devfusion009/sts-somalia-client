import { requireUser } from "@/lib/auth/session";
import { getMyAffiliate, getMyLinks, getMyConversions, getMyPayouts } from "@/modules/affiliates/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}

export default async function AffiliateDashboardPage() {
  const profile = await requireUser();
  const affiliate = await getMyAffiliate(profile.id);

  if (!affiliate) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No affiliate account found for your profile. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }

  const [links, conversions, payouts] = await Promise.all([
    getMyLinks(affiliate.id),
    getMyConversions(affiliate.id),
    getMyPayouts(affiliate.id),
  ]);

  const totalClicks = links.reduce((sum, l) => sum + l.clicks_count, 0);
  const pendingConversions = conversions.filter((c) => c.status === "pending").length;
  const approvedConversions = conversions.filter((c) => c.status === "approved").length;
  const paidConversions = conversions.filter((c) => c.status === "paid").length;

  // Computed live, not a denormalized counter — affiliates.total_earned/
  // total_paid were dropped (see migration 20260814000001): they never had
  // a writer anywhere, always silently read $0.00. "Earned" is every
  // conversion not reversed (approved + paid); "paid out" is the sum of
  // actual payout records, not the sum of paid-status conversions — those
  // two can legitimately differ (an admin payout amount is a real-world
  // round figure, not required to exactly equal the conversions it settles).
  const totalEarned = conversions
    .filter((c) => c.status !== "reversed")
    .reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const totalPaidOut = payouts.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <p className="text-sm text-muted-foreground">Track your referral links and commissions.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-muted-foreground">Your referral code</p>
            <p className="font-heading text-2xl font-semibold tracking-wide">{affiliate.referral_code}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={affiliate.status === "active" ? "default" : "secondary"} className="capitalize">
              {affiliate.status}
            </Badge>
            <Badge variant="secondary">{affiliate.commission_rate}% commission</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total clicks" value={totalClicks} />
        <StatCard label="Total earned" value={`$${totalEarned.toFixed(2)}`} />
        <StatCard label="Total paid out" value={`$${totalPaidOut.toFixed(2)}`} />
        <StatCard label="Links created" value={links.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pending conversions" value={pendingConversions} />
        <StatCard label="Approved conversions" value={approvedConversions} />
        <StatCard label="Paid conversions" value={paidConversions} />
      </div>
    </div>
  );
}
