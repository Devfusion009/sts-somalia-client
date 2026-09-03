import Link from "next/link";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyCustomersWithStats } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SelectCustomerButton } from "@/modules/agencies/components/select-customer-button";
import { AddCustomerForm } from "./add-customer-form";

function money(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(0)}`;
}

export default async function AgentCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { q } = await searchParams;
  const customers = await getAgencyCustomersWithStats(membership.agency.id, q);
  const registeredCount = customers.filter((c) => c.profile_id).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Customers</h1>
        <AddCustomerForm />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name, email, or phone"
            className="pl-9"
          />
        </form>
        {customers.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {customers.length} customer{customers.length === 1 ? "" : "s"} · {registeredCount} with
            an STS account
          </p>
        ) : null}
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {q ? `No customers match “${q}”.` : "No customers yet."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Last booking</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link
                        href={`/agent/customers/${customer.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {customer.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.phone ?? customer.email ?? "—"}
                      {customer.phone && customer.email ? (
                        <span className="block text-xs">{customer.email}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {customer.profile_id ? (
                        <Badge className="border-transparent bg-primary/10 text-primary">
                          STS account
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{customer.bookings}</TableCell>
                    <TableCell className="text-right text-sm">
                      {customer.spent > 0 ? money(customer.spent, customer.currency) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {customer.lastBookingAt
                        ? format(new Date(customer.lastBookingAt), "d MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <SelectCustomerButton
                        customerId={customer.id}
                        label="Book"
                        redirectTo="/agent/book"
                      />
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
