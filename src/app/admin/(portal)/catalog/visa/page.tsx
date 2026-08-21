import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getVisaTypesAdmin } from "@/modules/admin/queries";
import { countryName } from "@/lib/countries";

const STATUS_VARIANT: Record<string, "default" | "secondary"> = {
  published: "default",
  draft: "secondary",
  pending_review: "secondary",
  suspended: "secondary",
};

export default async function AdminVisaCatalogPage() {
  const visaTypes = await getVisaTypesAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Visa Catalog</h1>
        </div>
        <Button render={<Link href="/admin/catalog/visa/new" />}>
          <Plus /> Add visa type
        </Button>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destination</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visaTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No visa types yet.
                </TableCell>
              </TableRow>
            ) : (
              visaTypes.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{countryName(v.destination_country_code)}</TableCell>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>
                    {v.currency} {Number(v.price).toFixed(0)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[v.status] ?? "secondary"} className="capitalize">
                      {v.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" render={<Link href={`/admin/catalog/visa/${v.id}/edit`} />}>
                      <Pencil /> Edit
                    </Button>
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
