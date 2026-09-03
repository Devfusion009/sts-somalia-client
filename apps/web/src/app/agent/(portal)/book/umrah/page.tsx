import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomer } from "@/modules/agencies/booking-context";
import { getAllPackages } from "@/modules/umrah/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AgentUmrahDeskPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customer = await getBookingCustomer(supabase, membership.agency.id);
  if (!customer) redirect("/agent/book");

  const packages = await getAllPackages();

  return (
    <div className="space-y-4">
      <Link
        href="/agent/book"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Services
      </Link>

      <h1 className="font-heading text-2xl font-bold">Umrah</h1>

      {packages.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No packages published yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead className="text-right">Nights</TableHead>
                  <TableHead>Next departure</TableHead>
                  <TableHead className="text-right">Seats</TableHead>
                  <TableHead className="text-right">From</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg) => {
                  const seatsLeft = pkg.nextDeparture
                    ? pkg.nextDeparture.total_seats - pkg.nextDeparture.booked_seats
                    : null;
                  return (
                    <TableRow key={pkg.id}>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{pkg.name}</span>
                          {pkg.tier ? (
                            <Badge className="border-transparent bg-secondary capitalize text-secondary-foreground">
                              {pkg.tier}
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {pkg.duration_days}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {pkg.nextDeparture
                          ? format(new Date(pkg.nextDeparture.departure_date), "d MMM yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {seatsLeft ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {pkg.currency} {Number(pkg.base_price).toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/agent/book/umrah/${pkg.slug}`} />}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
