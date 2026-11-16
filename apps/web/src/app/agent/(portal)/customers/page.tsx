import { AgentMoney } from "@/components/portal/agent-money";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Search, UsersRound, Mail, Phone, ArrowUpRight } from "lucide-react";
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
import styles from "@/modules/agencies/components/customer-profile.module.css";
import directory from "./customers.module.css";
import { AddCustomerForm } from "./add-customer-form";

export const metadata = { title: "Customers" };

export default async function AgentCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { q, page: pageParam, sort: sortParam } = await searchParams;
  const sort = sortParam === "recent" ? "recent" : "name";
  const page = parsePage(pageParam);
  const { customers, total } = await getAgencyCustomersWithStats(
    membership.agency.id,
    { search: q, page, sort }
  );
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort === "recent") params.set("sort", sort);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/agent/customers?${qs}` : "/agent/customers";
  };
  if (page > 1 && customers.length === 0) redirect(hrefFor(1));

  return (
    <div className={directory.page}>
      <PageHeader
        title="Customers"
        actions={<AddCustomerForm />}
      />

      <form role="search" className={directory.toolbar}>
        <InputGroup className="h-10 min-w-0 flex-1 sm:max-w-96">
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
        <label className={directory.sort}>Sort by
          <select name="sort" defaultValue={sort} className={directory.select}>
            <option value="name">Customer name</option>
            <option value="recent">Latest booking</option>
          </select>
        </label>

      </form>

      <div className={directory.sectionHeading}>
        <h2><UsersRound aria-hidden="true" /> Customer directory <Badge variant="neutral">{total}</Badge></h2>
        <span>{customers.length} shown{q ? ` · Search: ${q}` : ""}</span>
      </div>
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
              <div className={`${directory.contacts} mt-2`}>
                {customer.phone?.trim() ? <a href={`tel:${customer.phone}`}><Phone aria-hidden="true" />{customer.phone}</a> : <Link className={directory.missing} href={`/agent/customers/${customer.id}`}>Add mobile number</Link>}
                {customer.email?.trim() ? <a className="break-all" href={`mailto:${customer.email}`}><Mail aria-hidden="true" />{customer.email}</a> : <Link className={directory.missing} href={`/agent/customers/${customer.id}`}>Add email address</Link>}
              </div>
              <span className="mt-1 block text-xs text-muted-foreground tabular-nums">{customer.bookings} booking{customer.bookings === 1 ? "" : "s"}</span>
              {customer.spent > 0 ? <span className="mt-2 block text-sm"><AgentMoney value={money(customer.spent, customer.currency)} /></span> : null}
            </div>
            <SelectCustomerButton customerId={customer.id} label="New booking" redirectTo="/agent/book" />
          </li>)}
        </ul>
        <Card className="hidden overflow-hidden py-0 sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Contact status</TableHead>
                <TableHead numeric>Bookings</TableHead>
                <TableHead numeric >Total spent</TableHead>
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
                    <Link href={`/agent/customers/${customer.id}`} className={styles.directoryIdentity}>
                      <span aria-hidden="true" className={styles.directoryAvatar}>{customer.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
                      <span><span className="font-semibold">{customer.full_name}</span><span className={styles.directoryLabel}>View profile <ArrowUpRight className="inline size-3" aria-hidden="true" /></span></span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className={directory.contacts}>
                      {customer.phone?.trim() ? <a href={`tel:${customer.phone}`}><Phone aria-hidden="true" />{customer.phone}</a> : <Link className={directory.missing} href={`/agent/customers/${customer.id}`}><Phone aria-hidden="true" />Add mobile number</Link>}
                      {customer.email?.trim() ? <a href={`mailto:${customer.email}`}><Mail aria-hidden="true" />{customer.email}</a> : <Link className={directory.missing} href={`/agent/customers/${customer.id}`}><Mail aria-hidden="true" />Add email address</Link>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.phone?.trim() && customer.email?.trim() ? "success" : "warning"}>
                      {customer.phone?.trim() && customer.email?.trim() ? "Contact complete" : "Contact missing"}
                    </Badge>
                    {customer.profile_id ? <span className={directory.account}>STS account</span> : null}
                  </TableCell>
                  <TableCell numeric className="text-sm">
                    <Badge variant="neutral" className="tabular-nums">{customer.bookings}</Badge>
                  </TableCell>
                  <TableCell numeric className="text-sm">
                    {customer.spent > 0 ? <AgentMoney value={money(customer.spent, customer.currency)} /> : "—"}
                  </TableCell>
                  <TableCell numeric className="text-sm text-muted-foreground">
                    {customer.lastBookingAt
                      ? format(new Date(customer.lastBookingAt), "d MMM yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell numeric>
                    <SelectCustomerButton
                      customerId={customer.id}
                      label="New booking"
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
