import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Search, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyCustomersWithStats } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SelectCustomerButton } from "@/modules/agencies/components/select-customer-button";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { AddCustomerForm } from "./add-customer-form";

export const metadata = { title: "Customers" };

export default async function AgentCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { q, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const { customers, total, registered: registeredCount } = await getAgencyCustomersWithStats(
    membership.agency.id,
    { search: q, page }
  );
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/agent/customers?${qs}` : "/agent/customers";
  };
  if (page > 1 && customers.length === 0) redirect(hrefFor(1));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        meta={
          total > 0
            ? `${total} customer${total === 1 ? "" : "s"} · ${registeredCount} with an STS account`
            : undefined
        }
        actions={<AddCustomerForm />}
      />

      <form role="search" className="flex items-center gap-2">
        <InputGroup className="sm:w-72 max-sm:h-10">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, email or phone"
            aria-label="Search customers"
          />
        </InputGroup>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {customers.length === 0 ? (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <UsersRound />
            </EmptyMedia>
            <EmptyTitle>{q ? `No customers match “${q}”` : "No customers"}</EmptyTitle>
          </Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Account</TableHead>
                <TableHead numeric>Bookings</TableHead>
                <TableHead numeric>Spent</TableHead>
                <TableHead numeric>Last booking</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link
                      href={`/agent/customers/${customer.id}`}
                      className="rounded-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
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
                      <Badge variant="info">STS account</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell numeric className="text-sm">
                    {customer.bookings}
                  </TableCell>
                  <TableCell numeric className="text-sm">
                    {customer.spent > 0 ? money(customer.spent, customer.currency) : "—"}
                  </TableCell>
                  <TableCell numeric className="text-sm text-muted-foreground">
                    {customer.lastBookingAt
                      ? format(new Date(customer.lastBookingAt), "d MMM yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell numeric>
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
        </Card>
      )}

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
