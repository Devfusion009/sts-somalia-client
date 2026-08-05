import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getVisaTypesAdmin } from "@/modules/admin/queries";
import { countryName } from "@/lib/countries";
import { VisaTypeForm } from "./visa-type-form";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Visa Catalog</h1>
          <p className="text-sm text-muted-foreground">Manage the visa types customers can apply for.</p>
        </div>
        <VisaTypeForm />
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
                    <VisaTypeForm visaType={v} />
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
