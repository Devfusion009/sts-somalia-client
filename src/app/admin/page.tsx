import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Users,
  ShoppingCart,
  DollarSign,
  ClipboardCheck,
  Building2,
  Plane,
  FileText,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getDashboardStats,
  getRevenueTrend,
  getBookingsByType,
  getRecentOrdersWithItems,
  getTopHotels,
} from "@/lib/data/admin";
import { RevenueTrendChart } from "@/components/admin/revenue-trend-chart";
import { BookingsByTypeChart } from "@/components/admin/bookings-by-type-chart";
import { UsersByRoleChart } from "@/components/admin/users-by-role-chart";

const ROLE_LABELS: Record<string, string> = {
  customer: "Customers",
  agent: "Agents",
  hotel_partner: "Hotel Partners",
  affiliate: "Affiliates",
  admin: "Admins",
};

const ITEM_TYPE_ICON: Record<string, LucideIcon> = {
  hotel: Building2,
  flight: Plane,
  visa: FileText,
  umrah: Landmark,
};

export default async function AdminDashboardPage() {
  const [stats, revenueTrend, bookingsByType, recentOrders, topHotels] = await Promise.all([
    getDashboardStats(),
    getRevenueTrend(),
    getBookingsByType(),
    getRecentOrdersWithItems(6),
    getTopHotels(5),
  ]);

  const usersByRoleData = Object.entries(ROLE_LABELS).map(([role, label]) => ({
    role,
    label,
    count: stats.usersByRole[role] ?? 0,
  }));

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

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Revenue trend</CardTitle>
            <p className="text-sm text-muted-foreground">Paid revenue and order volume, last 6 months.</p>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={revenueTrend} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Bookings by type</CardTitle>
            <p className="text-sm text-muted-foreground">Paid order items, by product line.</p>
          </CardHeader>
          <CardContent>
            <BookingsByTypeChart data={bookingsByType} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent orders</CardTitle>
              <p className="text-sm text-muted-foreground">The latest orders placed across the platform.</p>
            </div>
            <Button size="sm" variant="outline" render={<Link href="/admin/orders" />}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              recentOrders.map((order) => {
                const firstType = order.order_items[0]?.item_type;
                const Icon = firstType ? ITEM_TYPE_ICON[firstType] : ShoppingCart;
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{order.customer?.full_name ?? "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {order.order_number} · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold">
                        {order.currency} {Number(order.total).toFixed(0)}
                      </span>
                      <Badge variant="secondary" className="capitalize">
                        {order.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top hotels</CardTitle>
            <p className="text-sm text-muted-foreground">By confirmed booking revenue.</p>
          </CardHeader>
          <CardContent className="space-y-1">
            {topHotels.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No confirmed bookings yet.</p>
            ) : (
              topHotels.map((hotel) => (
                <div key={hotel.name} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{hotel.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {hotel.city} · {hotel.bookings} booking{hotel.bookings > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">${hotel.revenue.toFixed(0)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users by role</CardTitle>
        </CardHeader>
        <CardContent>
          <UsersByRoleChart data={usersByRoleData} />
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
