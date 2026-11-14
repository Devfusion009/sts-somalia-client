import type { Metadata } from "next";
import Link from "next/link";
import { Settings2, Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUmrahPackagesAdmin } from "@/modules/admin/queries";
import { money } from "@/lib/money";
import { getServerTrpc } from "@/lib/trpc/server";
import { UmrahPackageForm } from "./umrah-package-form";

export const metadata: Metadata = { title: "Umrah Catalog" };

export default async function AdminUmrahCatalogPage() {
  const [packages, airports] = await Promise.all([getUmrahPackagesAdmin(), (await getServerTrpc()).flights.airports.query()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Umrah packages"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {packages.length}
          </Badge>
        }
        actions={<UmrahPackageForm airports={airports} />}
      />

      <Card className="overflow-hidden py-0">
        {packages.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Landmark />
            </EmptyMedia>
            <EmptyTitle>No Umrah packages</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Route</TableHead>
                <TableHead numeric>Duration</TableHead>
                <TableHead numeric>Price</TableHead>
                <TableHead numeric>Departures</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell>
                    <Link
                      href={`/admin/catalog/umrah/${pkg.id}`}
                      className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {pkg.name}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">{pkg.package_type === "private" ? "Private · admin approval" : "Group"}</div>
                  </TableCell>
                  <TableCell>{pkg.origin_iata && pkg.destination_iata ? `${pkg.origin_iata} → ${pkg.destination_iata}` : <Badge variant="warning">Route missing</Badge>}</TableCell>
                  <TableCell numeric>{pkg.duration_days} days</TableCell>
                  <TableCell numeric className="whitespace-nowrap">
                    {money(pkg.base_price, pkg.currency)}
                  </TableCell>
                  <TableCell numeric>{pkg.umrah_package_departures?.length ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(pkg.status)} className="capitalize">
                      {pkg.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell numeric>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Configure ${pkg.name}`}
                        title="Configure"
                        render={<Link href={`/admin/catalog/umrah/${pkg.id}`} />}
                      >
                        <Settings2 aria-hidden="true" /> Configure package
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
