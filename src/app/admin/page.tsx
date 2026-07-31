import Link from "next/link";
import { Users, ShoppingCart, DollarSign, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/lib/data/admin";

const ROLE_LABELS: Record<string, string> = {
  customer: "Customers",
  agent: "Agents",
  hotel_partner: "Hotel Partners",
  affiliate: "Affiliates",
  admin: "Admins",
};

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform-wide overview.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={stats.totalUsers} />
        <StatCard icon={ShoppingCart} label="Total orders" value={stats.totalOrders} />
        <StatCard icon={DollarSign} label="Revenue (paid/completed)" value={`$${stats.revenue.toFixed(0)}`} />
        <StatCard icon={ClipboardCheck} label="Pending applications" value={stats.pendingApplications} />
      </div>

      {stats.pendingApplications > 0 ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <p className="text-sm font-medium">
              {stats.pendingApplications} application{stats.pendingApplications > 1 ? "s" : ""} waiting for review
              ({stats.pendingAgency} agency, {stats.pendingPartner} partner, {stats.pendingAffiliate} affiliate).
            </p>
            <Button size="sm" render={<Link href="/admin/applications" />}>
              Review now
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users by role</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <div key={role}>
              <p className="text-2xl font-semibold">{stats.usersByRole[role] ?? 0}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <span className="text-2xl font-semibold">{value}</span>
        <Icon className="size-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">{label}</CardContent>
    </Card>
  );
}
