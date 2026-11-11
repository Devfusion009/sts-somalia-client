import { AgentMoney } from "@/components/portal/agent-money";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, Landmark } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomer } from "@/modules/agencies/booking-context";
import { getAllPackages } from "@/modules/umrah/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Umrah" };

export default async function AgentUmrahDeskPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customer = await getBookingCustomer(supabase, membership.agency.id);
  if (!customer) redirect("/agent/book?service=umrah");

  const packages = await getAllPackages();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Umrah"
        back={{ href: "/agent/book", label: "Services" }}
        actions={
          <Button variant="outline" render={<Link href="/agent/book/umrah/private" />}>
            Build private Umrah <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        }
      />

      <Card className="overflow-hidden py-0">
        {packages.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Landmark />
            </EmptyMedia>
            <EmptyTitle>No group packages</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead numeric>Days</TableHead>
                <TableHead numeric>Next departure</TableHead>
                <TableHead numeric>Seats left</TableHead>
                <TableHead numeric>From / person</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => {
                const seatsLeft = pkg.nextDeparture
                  ? pkg.nextDeparture.total_seats -
                    pkg.nextDeparture.booked_seats -
                    pkg.nextDeparture.offline_seats
                  : null;
                return (
                  <TableRow key={pkg.id}>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{pkg.name}</span>
                        {pkg.tier ? (
                          <Badge variant="neutral" className="capitalize">
                            {pkg.tier}
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell numeric className="text-sm">
                      {pkg.duration_days}
                    </TableCell>
                    <TableCell numeric className="text-sm text-muted-foreground">
                      {pkg.nextDeparture
                        ? format(new Date(pkg.nextDeparture.departure_date), "d MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell numeric className="text-sm">
                      {seatsLeft === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : seatsLeft <= 0 ? (
                        <Badge variant="neutral">Full</Badge>
                      ) : (
                        seatsLeft
                      )}
                    </TableCell>
                    <TableCell numeric className="text-sm font-medium">
                      {<AgentMoney value={money(Number(pkg.base_price), pkg.currency)} />}
                    </TableCell>
                    <TableCell numeric>
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/agent/book/umrah/${pkg.slug}`} />}
                      >
                        View package
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
