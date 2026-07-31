import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUmrahPackageById } from "@/lib/data/admin";
import { DeparturesForm } from "./departures-form";

export default async function UmrahPackageDeparturesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pkg = await getUmrahPackageById(id);
  if (!pkg) notFound();

  const departures = [...(pkg.umrah_package_departures ?? [])].sort((a, b) =>
    a.departure_date.localeCompare(b.departure_date)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{pkg.name}</h1>
        <p className="text-sm text-muted-foreground">
          {pkg.duration_days} days · {pkg.currency} {Number(pkg.base_price).toFixed(0)} base price
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a departure</CardTitle>
        </CardHeader>
        <CardContent>
          <DeparturesForm packageId={pkg.id} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Departure</TableHead>
              <TableHead>Return</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Price override</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  No departures scheduled yet.
                </TableCell>
              </TableRow>
            ) : (
              departures.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{new Date(d.departure_date).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(d.return_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {d.booked_seats} / {d.total_seats} booked
                  </TableCell>
                  <TableCell>{d.price_override ? `${pkg.currency} ${Number(d.price_override).toFixed(0)}` : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
