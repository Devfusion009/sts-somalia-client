import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUmrahPackagesAdmin } from "@/lib/data/admin";
import { UmrahPackageForm } from "./umrah-package-form";

const STATUS_VARIANT: Record<string, "default" | "secondary"> = {
  published: "default",
  draft: "secondary",
  pending_review: "secondary",
  suspended: "secondary",
};

export default async function AdminUmrahCatalogPage() {
  const packages = await getUmrahPackagesAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Umrah Catalog</h1>
          <p className="text-sm text-muted-foreground">Manage packages and their departures.</p>
        </div>
        <UmrahPackageForm />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Departures</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No Umrah packages yet.
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>{pkg.duration_days} days</TableCell>
                  <TableCell>
                    {pkg.currency} {Number(pkg.base_price).toFixed(0)}
                  </TableCell>
                  <TableCell>{pkg.umrah_package_departures?.length ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[pkg.status] ?? "secondary"} className="capitalize">
                      {pkg.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-2 text-right">
                    <Button size="sm" variant="outline" render={<Link href={`/admin/catalog/umrah/${pkg.id}`} />}>
                      <CalendarDays /> Departures
                    </Button>
                    <UmrahPackageForm pkg={pkg} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
