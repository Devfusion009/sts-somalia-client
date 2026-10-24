import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUmrahPackagesAdmin } from "@/modules/admin/queries";
import { money } from "@/lib/money";
import { UmrahPackageForm } from "./umrah-package-form";

export const metadata: Metadata = { title: "Umrah Catalog" };

export default async function AdminUmrahCatalogPage() {
  const packages = await getUmrahPackagesAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Umrah Catalog"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {packages.length}
          </Badge>
        }
        actions={<UmrahPackageForm />}
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
                  </TableCell>
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
                      <UmrahPackageForm pkg={pkg} />
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Configure ${pkg.name}`}
                        title="Configure"
                        render={<Link href={`/admin/catalog/umrah/${pkg.id}`} />}
                      >
                        <ChevronRight />
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
