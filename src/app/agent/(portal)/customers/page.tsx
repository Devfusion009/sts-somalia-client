import { format } from "date-fns";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getAgencyCustomers } from "@/modules/agencies/booked-for";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddCustomerForm } from "./add-customer-form";

export default async function AgentCustomersPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customers = await getAgencyCustomers(supabase, membership.agency.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {membership.agency.name}&apos;s client book — pick any of them in the &ldquo;Booking
            for&rdquo; field when you book.
          </p>
        </div>
        <AddCustomerForm />
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-medium">No customers saved yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Add your clients here (or on the fly from any booking form) and every booking you
              make for them is tracked against their name.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.email ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                      {customer.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(customer.created_at), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
