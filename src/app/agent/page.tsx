import Link from "next/link";
import { Building2, Plane, FileText, Landmark } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyBookings } from "@/lib/data/agent-portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BROWSE_LINKS = [
  { href: "/hotels", label: "Hotels", icon: Building2 },
  { href: "/flights", label: "Flights", icon: Plane },
  { href: "/visa", label: "Visa", icon: FileText },
  { href: "/umrah", label: "Umrah", icon: Landmark },
];

export default async function AgentDashboardPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null; // layout already handles this case

  const bookings = await getAgencyBookings(membership.agency.id);
  const byType = {
    hotel: bookings.filter((b) => b.type === "hotel").length,
    flight: bookings.filter((b) => b.type === "flight").length,
    visa: bookings.filter((b) => b.type === "visa").length,
    umrah: bookings.filter((b) => b.type === "umrah").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{membership.agency.name}</h1>
          <p className="text-sm text-muted-foreground">{membership.agency.contact_email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={membership.agency.status === "active" ? "default" : "secondary"} className="capitalize">
            {membership.agency.status}
          </Badge>
          <Badge variant="secondary">{membership.agency.commission_rate}% commission</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Hotel bookings" value={byType.hotel} />
        <StatCard label="Flight bookings" value={byType.flight} />
        <StatCard label="Visa applications" value={byType.visa} />
        <StatCard label="Umrah bookings" value={byType.umrah} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Make a new booking</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Book through the same pages your customers use — bookings you make while signed in are
            automatically attributed to {membership.agency.name}.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BROWSE_LINKS.map((link) => (
              <Button key={link.href} variant="outline" className="h-auto flex-col gap-2 py-4" render={<Link href={link.href} />}>
                <link.icon className="size-5" />
                {link.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
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
