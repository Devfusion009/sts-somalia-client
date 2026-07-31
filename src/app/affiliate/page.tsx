import { requireUser } from "@/lib/auth/session";
import { getMyAffiliate, getMyLinks, getMyConversions } from "@/lib/data/affiliate-portal";
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

  const [links, conversions] = await Promise.all([getMyLinks(affiliate.id), getMyConversions(affiliate.id)]);

  const totalClicks = links.reduce((sum, l) => sum + l.clicks_count, 0);
  const pendingConversions = conversions.filter((c) => c.status === "pending").length;
  const approvedConversions = conversions.filter((c) => c.status === "approved").length;
  const paidConversions = conversions.filter((c) => c.status === "paid").length;

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
        <StatCard label="Total earned" value={`$${affiliate.total_earned.toFixed(2)}`} />
        <StatCard label="Total paid out" value={`$${affiliate.total_paid.toFixed(2)}`} />
        <StatCard label="Links created" value={links.length} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending conversions" value={pendingConversions} />
        <StatCard label="Approved conversions" value={approvedConversions} />
        <StatCard label="Paid conversions" value={paidConversions} />
      </div>
    </div>
  );
}
