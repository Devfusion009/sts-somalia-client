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

      <form role="search" className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4">
        <InputGroup className="min-w-0 flex-1 sm:max-w-80">
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
        {q ? <Button variant="ghost" render={<Link href="/agent/customers" />}>Clear</Button> : null}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{registeredCount} STS account{registeredCount === 1 ? "" : "s"}</span>
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
        <>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card px-4 sm:hidden">
          {customers.map((customer) => <li key={customer.id} className="flex items-center gap-3 py-4">
            <div className="min-w-0 flex-1">
              <Link href={`/agent/customers/${customer.id}`} className="block truncate text-sm font-semibold hover:text-primary">{customer.full_name}</Link>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{customer.phone ?? customer.email ?? "—"}</span>
              <span className="mt-1 block text-xs text-muted-foreground tabular-nums">{customer.bookings} booking{customer.bookings === 1 ? "" : "s"}</span>
            </div>
            <SelectCustomerButton customerId={customer.id} label="Book" redirectTo="/agent/book" />
          </li>)}
        </ul>
        <Card className="hidden overflow-hidden py-0 sm:block">
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
                    <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">{customer.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
                    <Link
                      href={`/agent/customers/${customer.id}`}
                      className="rounded-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {customer.full_name}
                    </Link>
                    </div>
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
        </>
      )}

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
