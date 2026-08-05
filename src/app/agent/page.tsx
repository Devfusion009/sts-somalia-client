import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Hotel,
  Landmark,
  PartyPopper,
  Percent,
  Plane,
  Stamp,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyOrders, getAgencyTeam } from "@/modules/agencies/queries";
import { describeOrderItem } from "@/modules/payments/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const SERVICE_TILES = [
  {
    href: "/flights",
    title: "Flight Booking",
    description: "Search and book flights for your clients",
    icon: Plane,
    tint: "bg-primary/10 text-primary",
  },
  {
    href: "/hotels",
    title: "Hotel Booking",
    description: "Find and book hotels worldwide",
    icon: Hotel,
    tint: "bg-brand-accent/10 text-brand-accent",
  },
  {
    href: "/visa",
    title: "Visa Management",
    description: "Apply and track visa applications",
    icon: Stamp,
    tint: "bg-chart-3/10 text-chart-3",
  },
  {
    href: "/umrah",
    title: "Umrah Packages",
    description: "Book Umrah packages for your customers",
    icon: Landmark,
    tint: "bg-chart-4/10 text-chart-4",
  },
  {
    href: "/events",
    title: "Event Halls",
    description: "Reserve halls for weddings and events",
    icon: PartyPopper,
    tint: "bg-brand-gold/15 text-brand-gold",
  },
  {
    href: "/agent/bookings",
    title: "My Bookings",
    description: "View and manage your agency bookings",
    icon: Ticket,
    tint: "bg-secondary text-secondary-foreground",
  },
];

const ORDER_STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-brand-gold/15 text-brand-gold",
  paid: "bg-primary/10 text-primary",
  processing: "bg-chart-3/10 text-chart-3",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-destructive/10 text-destructive",
};

function money(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toFixed(0)}`;
}

export default async function AgentDashboardPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null; // layout already handles this case

  const [orders, team] = await Promise.all([
    getAgencyOrders(membership.agency.id),
    getAgencyTeam(membership.agency.id),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const paidStatuses = new Set(["paid", "processing", "completed"]);

  const totalItems = orders.reduce((sum, o) => sum + o.order_items.length, 0);
  const revenueThisMonth = orders
    .filter((o) => paidStatuses.has(o.status) && (o.paid_at ?? o.created_at) >= monthStart)
    .reduce((sum, o) => sum + Number(o.total), 0);
  const pendingOrders = orders.filter((o) => o.status === "pending_payment");
  const pendingValue = pendingOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const currency = orders[0]?.currency ?? "USD";
  const recentOrders = orders.slice(0, 5);

  const stats = [
    {
      label: "Total Bookings",
      value: String(totalItems),
      sub: `${orders.length} orders`,
      icon: Ticket,
      tint: "bg-primary/10 text-primary",
    },
    {
      label: "Revenue This Month",
      value: money(revenueThisMonth, currency),
      sub: "Paid orders",
      icon: Wallet,
      tint: "bg-chart-3/10 text-chart-3",
    },
    {
      label: "Pending Payments",
      value: String(pendingOrders.length),
      sub: money(pendingValue, currency),
      icon: CalendarClock,
      tint: "bg-brand-gold/15 text-brand-gold",
    },
    {
      label: "Team Members",
      value: String(team.length),
      sub: "Active access",
      icon: Users,
      tint: "bg-chart-4/10 text-chart-4",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋</p>
          <h1 className="font-heading text-2xl font-bold">{membership.agency.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "border-transparent capitalize",
              membership.agency.status === "active"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {membership.agency.status}
          </Badge>
          <Badge className="gap-1 border-transparent bg-brand-accent/10 text-brand-accent">
            <Percent className="size-3" /> {membership.agency.commission_rate}% commission
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-1 truncate font-heading text-2xl font-bold">{stat.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</p>
              </div>
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", stat.tint)}>
                <stat.icon className="size-4.5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Service tiles */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold">Book for your clients</h2>
            <p className="text-sm text-muted-foreground">
              Bookings made while signed in are automatically attributed to{" "}
              {membership.agency.name} with your B2B commission.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SERVICE_TILES.map((tile) => (
            <Link key={tile.href} href={tile.href} className="group">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                <CardContent className="flex h-full flex-col items-start gap-3 pt-6">
                  <span className={cn("flex size-11 items-center justify-center rounded-full", tile.tint)}>
                    <tile.icon className="size-5" />
                  </span>
                  <div className="flex-1">
                    <p className="font-heading text-sm font-bold">{tile.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{tile.description}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                    Open <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent bookings */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent Bookings</CardTitle>
          <Button variant="ghost" size="sm" className="gap-1 text-primary" render={<Link href="/agent/bookings" />}>
            View all <ArrowRight className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No bookings yet — use the tiles above to make your first booking for a client.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => {
                  const first = order.order_items[0];
                  const info = first ? describeOrderItem(first) : null;
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <p className="font-mono text-xs font-medium">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), "d MMM yyyy")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{info?.title ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{info?.subtitle}</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border-transparent capitalize",
                            ORDER_STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {money(order.total, order.currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
