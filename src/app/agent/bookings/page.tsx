import { Building2, Plane, FileText, Landmark } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyBookings } from "@/lib/data/agent-portal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TYPE_ICON = { hotel: Building2, flight: Plane, visa: FileText, umrah: Landmark };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  confirmed: "default",
  completed: "default",
  approved: "default",
  issued: "default",
  pending: "secondary",
  submitted: "secondary",
  in_review: "secondary",
  additional_info_required: "secondary",
  draft: "secondary",
  cancelled: "destructive",
  rejected: "destructive",
  failed: "destructive",
  refunded: "secondary",
  no_show: "destructive",
};

export default async function AgentBookingsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const bookings = await getAgencyBookings(membership.agency.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Agency Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Every hotel, flight, visa, and Umrah booking made through {membership.agency.name}.
        </p>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-medium">No bookings yet</p>
            <p className="text-sm text-muted-foreground">
              Bookings made while signed in to this account are attributed here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => {
                const Icon = TYPE_ICON[b.type];
                return (
                  <TableRow key={`${b.type}-${b.id}`}>
                    <TableCell className="flex items-center gap-2 font-medium capitalize">
                      <Icon className="size-4 text-muted-foreground" /> {b.type}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.subtitle}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[b.status] ?? "secondary"} className="capitalize">
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {b.currency} {b.price.toFixed(0)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
