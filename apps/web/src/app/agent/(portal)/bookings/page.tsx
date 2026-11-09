import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, Building2, Download, Landmark, PartyPopper, Plane, Plus, Receipt, Search, Stamp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyOrders } from "@/modules/agencies/queries";
import { BOOKING_PRODUCTS, BOOKING_QUEUES, BOOKING_STATUS_LABELS, bookingListHref, parseBookingFilters, type BookingSearchParams } from "@/modules/agencies/booking-filters";
import { describeOrderItem } from "@/modules/orders/format";
import { AgentMoney } from "@/components/portal/agent-money";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parsePage } from "@/lib/pagination";
import { Pager } from "@/components/dashboard/pager";
import { money } from "@/lib/money";

const TYPE_ICON = { hotel: Building2, flight: Plane, visa: Stamp, umrah: Landmark, hall: PartyPopper } as const;
type AgencyOrder = Awaited<ReturnType<typeof getAgencyOrders>>["orders"][number];
const PAYABLE = ["pending_payment", "held", "partially_paid"];

export const metadata = { title: "Bookings" };

export default async function AgentBookingsPage({ searchParams }: { searchParams: Promise<BookingSearchParams> }) {
  const params = await searchParams;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;
  const canBook = ["owner", "admin", "booking_staff"].includes(membership.roleInAgency);
  const filters = parseBookingFilters(params);
  const page = parsePage(Array.isArray(params.page) ? params.page[0] : params.page);
  const { orders, total } = await getAgencyOrders(membership.agency.id, { ...filters, page });
  const hrefFor = (target: number) => bookingListHref(filters, { page: target });
  if (page > 1 && orders.length === 0) redirect(hrefFor(1));
  const filtered = Boolean(filters.type || filters.q || filters.from || filters.to || filters.queue !== "all");
  const exportHref = bookingListHref(filters).replace("/agent/bookings", "/agent/bookings/export");

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" actions={<>
        <Button variant="outline" nativeButton={false} render={<a href={exportHref} />}><Download data-icon="inline-start" aria-hidden="true" />Export CSV</Button>
        {canBook ? <Button render={<Link href="/agent/book" />}><Plus data-icon="inline-start" aria-hidden="true" />New booking</Button> : null}
      </>} />

      <section aria-label="Booking filters" className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <FilterChips label="Booking status" active={filters.queue ?? "all"} items={BOOKING_QUEUES.map((item) => ({ ...item, href: bookingListHref(filters, { queue: item.key }) }))} />
        <form key={bookingListHref(filters)} action="/agent/bookings" method="get" role="search" aria-label="Search bookings" className="grid gap-3 border-y border-border py-4 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_10rem_10rem_9rem_auto]">
          {filters.type ? <input type="hidden" name="type" value={filters.type} /> : null}
          {filters.queue !== "all" ? <input type="hidden" name="queue" value={filters.queue} /> : null}
          <div className="space-y-2 sm:col-span-2 xl:col-span-1">
            <Label htmlFor="booking-search">Search bookings</Label>
            <InputGroup>
              <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
              <InputGroupInput id="booking-search" name="q" type="search" defaultValue={filters.q} maxLength={120} placeholder="Order, customer or phone" />
            </InputGroup>
          </div>
          <div className="space-y-2"><Label htmlFor="booking-from">Booked from</Label><Input id="booking-from" name="from" type="date" defaultValue={filters.from} /></div>
          <div className="space-y-2"><Label htmlFor="booking-to">Booked to</Label><Input id="booking-to" name="to" type="date" defaultValue={filters.to} /></div>
          <div className="space-y-2"><Label htmlFor="booking-sort">Order</Label><select id="booking-sort" name="sort" defaultValue={filters.sort} className={NATIVE_SELECT_CLASS}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
          <div className="flex items-end gap-2"><Button type="submit" className="max-sm:flex-1">Apply</Button>{filtered || filters.sort === "oldest" ? <Button variant="ghost" render={<Link href="/agent/bookings" />}>Reset</Button> : null}</div>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips label="Booking product" active={filters.type ?? "all"} items={BOOKING_PRODUCTS.map((item) => ({ ...item, href: bookingListHref(filters, { type: item.key === "all" ? undefined : item.key }) }))} />
          <span role="status" className="text-xs text-muted-foreground tabular-nums">{total} booking{total === 1 ? "" : "s"}</span>
        </div>
      </section>

      {orders.length === 0 ? <Card><Empty><EmptyMedia variant="icon"><Receipt /></EmptyMedia><EmptyTitle>{filtered ? "No matching bookings" : "No bookings"}</EmptyTitle><EmptyContent>
        {filtered ? <Button variant="outline" render={<Link href="/agent/bookings" />}>Reset filters</Button> : canBook ? <Button render={<Link href="/agent/book" />}>Start a booking</Button> : null}
      </EmptyContent></Empty></Card> : <>
        <ul aria-label="Bookings" className="space-y-3 lg:hidden">
          {orders.map((order) => <li key={order.id} className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><BookingReference order={order} /><BookingStatus order={order} /></div>
            <BookingItems order={order} />
            <div className="flex items-start justify-between gap-4 border-t border-border pt-3"><BookingCustomer order={order} /><div className="text-right"><span className="mb-1 block text-xs text-muted-foreground">Total</span><BookingTotal order={order} /></div></div>
            <BookingActions order={order} canBook={canBook} />
          </li>)}
        </ul>
        <Card className="hidden overflow-hidden py-0 lg:block">
          <Table><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Booking</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead numeric className="bg-primary/5 text-primary">Total</TableHead><TableHead numeric>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{orders.map((order) => <TableRow key={order.id}>
              <TableCell className="align-top"><BookingReference order={order} /></TableCell>
              <TableCell className="align-top"><BookingItems order={order} /></TableCell>
              <TableCell className="align-top"><BookingCustomer order={order} /></TableCell>
              <TableCell className="align-top"><BookingStatus order={order} /></TableCell>
              <TableCell numeric className="bg-primary/5 align-top"><BookingTotal order={order} /></TableCell>
              <TableCell numeric className="align-top"><BookingActions order={order} canBook={canBook} /></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </Card>
      </>}
      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}

function awaitingPrice(order: AgencyOrder) {
  return Number(order.total) === 0 && PAYABLE.includes(order.status);
}

function BookingReference({ order }: { order: AgencyOrder }) {
  return (
    <div>
      <Link href={`/agent/bookings/${order.id}`} className="rounded-sm font-mono text-xs font-semibold outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
        {order.order_number}
      </Link>
      <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
        {format(new Date(order.created_at), "d MMM yyyy")}
      </span>
    </div>
  );
}

function BookingCustomer({ order }: { order: AgencyOrder }) {
  const customer = order.agency_customer;
  if (!customer) return <span className="text-sm text-muted-foreground">{order.customer_id === order.booked_by ? "Walk-in / self" : "Client account"}</span>;
  return (
    <div className="min-w-0 text-sm">
      <Link href={`/agent/customers/${customer.id}`} className="font-semibold break-words hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
        {customer.full_name}
      </Link>
      {customer.phone ? <span className="mt-1 block text-xs text-muted-foreground tabular-nums">{customer.phone}</span> : null}
    </div>
  );
}

function BookingItems({ order }: { order: AgencyOrder }) {
  return (
    <ul className="space-y-2">
      {order.order_items.map((item) => {
        const info = describeOrderItem(item);
        const Icon = TYPE_ICON[item.item_type];
        const status = item.hotel_booking?.status ?? item.hall_booking?.status;
        return (
          <li key={item.id} className="flex items-start gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><Icon className="size-4" aria-hidden="true" /></span>
            <div className="min-w-0 lg:max-w-64">
              <span className="block text-sm font-semibold whitespace-normal">{info.title}</span>
              {info.subtitle ? <span className="mt-0.5 block text-xs whitespace-normal text-muted-foreground">{info.subtitle}</span> : null}
              {status === "waitlisted" ? <Badge variant="warning" className="mt-1">Waitlisted</Badge> : status === "confirmed" ? <Badge variant="success" className="mt-1">{item.item_type === "hotel" ? "Room confirmed" : "Venue confirmed"}</Badge> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BookingStatus({ order }: { order: AgencyOrder }) {
  const paid = order.payments.find((payment) => payment.status === "succeeded");
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={awaitingPrice(order) ? "warning" : statusBadgeVariant(order.status)}>
        {awaitingPrice(order) ? "Awaiting price" : BOOKING_STATUS_LABELS[order.status]}
      </Badge>
      {paid?.method_label ? <span className="text-xs text-muted-foreground">{paid.method_label}</span> : null}
    </div>
  );
}

function BookingTotal({ order }: { order: AgencyOrder }) {
  const paid = order.payments.filter((p) => p.status === "succeeded").reduce((sum, p) => sum + Number(p.amount), 0);
  if (awaitingPrice(order)) return <span className="text-sm text-muted-foreground">On request</span>;
  return (
    <div>
      <AgentMoney value={money(order.total, order.currency)} />
      {order.status === "partially_paid" ? <span className="mt-1 block text-xs text-muted-foreground">Due <AgentMoney value={money(Math.max(Number(order.total) - paid, 0), order.currency)} /></span> : null}
    </div>
  );
}

function BookingActions({ order, canBook }: { order: AgencyOrder; canBook: boolean }) {
  const pending = order.payments.some((payment) => payment.provider === "waafi" && ["processing", "requires_action"].includes(payment.status));
  const waitlisted = order.order_items.some((item) => item.hotel_booking?.status === "waitlisted" || item.hall_booking?.status === "waitlisted");
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button size="sm" variant="outline" aria-label={`Open booking ${order.order_number}`} render={<Link href={`/agent/bookings/${order.id}`} />}>Open</Button>
      {canBook && !awaitingPrice(order) && !waitlisted && PAYABLE.includes(order.status) ? (
        <Button size="sm" render={<Link href={`/agent/book/order/${order.id}`} />}>
          {pending ? "Check payment" : "Pay now"}<ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Button>
      ) : null}
      {["paid", "partially_paid", "processing", "completed"].includes(order.status) ? (
        <Button size="icon-sm" variant="outline" aria-label={`Download invoice for ${order.order_number}`} title="Download invoice" render={<a href={`/api/invoices/${order.id}`} target="_blank" rel="noopener noreferrer" />}>
          <Download aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
