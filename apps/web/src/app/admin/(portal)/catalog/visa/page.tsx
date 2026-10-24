import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileText, Pencil, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getVisaTypesAdmin } from "@/modules/admin/queries";
import { countryName } from "@/lib/countries";
import { money } from "@/lib/money";

export const metadata: Metadata = { title: "Visa Catalog" };

export default async function AdminVisaCatalogPage() {
  const visaTypes = await getVisaTypesAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visa Catalog"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {visaTypes.length}
          </Badge>
        }
        actions={
          <>
            <Button variant="outline" render={<Link href="/admin/catalog/visa/centres" />}>
              <Building2 aria-hidden="true" /> Application centres
            </Button>
            <Button render={<Link href="/admin/catalog/visa/new" />}>
              <Plus aria-hidden="true" /> Add visa type
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden py-0">
        {visaTypes.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>No visa types</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destination</TableHead>
                <TableHead>Name</TableHead>
                <TableHead numeric>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visaTypes.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{countryName(v.destination_country_code)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/catalog/visa/${v.id}/edit`}
                      className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {v.name}
                    </Link>
                  </TableCell>
                  <TableCell numeric className="whitespace-nowrap">
                    {money(v.price, v.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(v.status)} className="capitalize">
                      {v.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell numeric>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${v.name}`}
                      title="Edit"
                      render={<Link href={`/admin/catalog/visa/${v.id}/edit`} />}
                    >
                      <Pencil />
                    </Button>
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
