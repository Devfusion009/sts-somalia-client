import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Plane, Ticket, Wallet, CircleCheck, CalendarDays, Users, Clock3, ArrowUpRight, Download, Plus } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAdminFlights, FLIGHT_VIEWS as FILTERS, type FlightFilters } from "@/modules/flights/admin-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/money";
import { RetryTicketingForm } from "./retry-form";

export const metadata = { title: "Flight bookings" };

const STATUS: Record<string, { label: string; variant: "neutral" | "info" | "success" | "destructive" }> = {
  awaiting_payment: { label: "Awaiting payment", variant: "neutral" },
  queued: { label: "Booking", variant: "info" },
  booking: { label: "Booking", variant: "info" },
  booked: { label: "Booked · ticket pending", variant: "info" },
  ticketed: { label: "Ticketed", variant: "success" },
  failed: { label: "Needs attention", variant: "destructive" },
  pending: { label: "Pending", variant: "info" },
  confirmed: { label: "Confirmed", variant: "success" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "neutral" },
  refunded: { label: "Refunded", variant: "neutral" },
  no_show: { label: "No show", variant: "neutral" },
  expired: { label: "Fare expired", variant: "neutral" },
};

function day(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function AdminFlightBookingsPage({ searchParams }: { searchParams: Promise<FlightFilters> }) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const filter = FILTERS.find(f => f.key === params.view) ?? FILTERS[0];
  const parsedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = 50;
  const [result, ...counts] = await Promise.all([
    getAdminFlights(params, (page - 1) * pageSize, pageSize),
    ...["all", "pending", "unpaid", "ticketed"].map(view => getAdminFlights({view}, 0, 1, true)),
  ]);
  const shown = result.data ?? [], count = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const href = (view: string, target = 1) => {
    const query = new URLSearchParams({view, page:String(target)});
    for (const key of ["q", "source", "days"] as const) if(params[key]) query.set(key, params[key]!);
    return `/admin/flights?${query}`;
  };
  const pageHref = (target: number) => href(filter.key,target);
  const exportHref = `/admin/flights/export?${new URLSearchParams(Object.entries(params).filter(([key,value]) => key !== "page" && Boolean(value)) as [string,string][]).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Flight bookings" actions={<Button render={<Link href="/flights#flight-search" />}><Plus /> New booking</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{label:"Total bookings",icon:Plane},{label:"Awaiting ticketing",icon:Ticket},{label:"Awaiting payment",icon:Wallet},{label:"Ticketed",icon:CircleCheck}].map((stat,index) => <Card key={stat.label} className="flex-row items-center gap-4 p-5 shadow-sm"><span className={`grid size-12 shrink-0 place-items-center rounded-xl ${index === 1 ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"}`}><stat.icon className="size-6" aria-hidden /></span><div><div className="text-sm text-muted-foreground">{stat.label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{counts[index].count ?? 0}</div></div></Card>)}
      </div>
      <Card className="gap-5 overflow-hidden p-4 sm:p-5">
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-64 flex-1"><label htmlFor="flight-search" className="sr-only">Search flight bookings</label><Input id="flight-search" name="q" defaultValue={params.q} placeholder="Search route, customer, PNR or booking ID" maxLength={100} /></div>
        <div className="space-y-2"><label htmlFor="flight-status" className="block text-xs font-medium text-muted-foreground">Status</label><select id="flight-status" name="view" defaultValue={filter.key} className={NATIVE_SELECT_CLASS}>{FILTERS.map(item => <option key={item.key} value={item.key}>{item.key === "all" ? "All statuses" : item.label}</option>)}</select></div>
        <div className="space-y-2"><label htmlFor="flight-source" className="block text-xs font-medium text-muted-foreground">Booking source</label><select id="flight-source" name="source" defaultValue={params.source ?? "all"} className={NATIVE_SELECT_CLASS}><option value="all">All sources</option><option value="b2b">B2B · Agency</option><option value="b2c">B2C · Customer</option></select></div>
        <div className="space-y-2"><label htmlFor="flight-days" className="block text-xs font-medium text-muted-foreground">Booked within</label><select id="flight-days" name="days" defaultValue={params.days ?? "all"} className={NATIVE_SELECT_CLASS}><option value="all">All dates</option>{[7,30,90].map(days => <option key={days} value={days}>Last {days} days</option>)}</select></div>
        <Button variant="outline" type="submit">Apply</Button><Button variant="outline" render={<a href={exportHref} />}><Download /> Export</Button>
        {params.q || params.source || params.days || filter.key !== "all" ? <Link href="/admin/flights" className="px-2 py-2 text-sm text-muted-foreground hover:underline">Reset</Link> : null}
      </form>

      <FilterChips
        label="Filter flight bookings"
        active={filter.key}
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          href: href(f.key),
        }))}
      />

      <div className="overflow-hidden rounded-xl border border-border">
        {shown.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Plane />
            </EmptyMedia>
            <EmptyTitle>No flight bookings</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Travel dates</TableHead>
                <TableHead>Passengers</TableHead>
                <TableHead>Customer · booking source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PNR · tickets</TableHead>
                <TableHead numeric>Fare</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead numeric>Booked</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((b) => {
                const statusKey = b.ticketing_status ?? b.status;
                const status = STATUS[statusKey] ?? { label: statusKey, variant: "neutral" as const };
                const agency = Array.isArray(b.agency) ? b.agency[0] : b.agency;
                const customer = Array.isArray(b.customer) ? b.customer[0] : b.customer;
                const agencyCustomer = Array.isArray(b.agency_customer) ? b.agency_customer[0] : b.agency_customer;
                const bookedBy = Array.isArray(b.booked_by_profile) ? b.booked_by_profile[0] : b.booked_by_profile;
                const item = b.order_items?.[0];
                const order = item ? (Array.isArray(item.order) ? item.order[0] : item.order) : null;
                return (
                  <TableRow key={b.id} className={statusKey === "failed" ? "align-middle bg-destructive/5" : "align-middle"}>
                    <TableCell>
                      <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Plane className="size-4" aria-hidden /></span><p className="whitespace-nowrap font-mono text-sm font-semibold">
                        {b.origin_iata} → {b.destination_iata}
                      </p></div>
                    </TableCell>
                    <TableCell><div className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /><div className="whitespace-nowrap text-xs">
                        {day(b.depart_at)}
                        {b.return_at ? ` – ${day(b.return_at)}` : " · one way"}
                      </div></div>
                      {order ? (
                        <Link href={`/admin/orders?order=${order.id}#order-${order.id}`} className="font-mono text-xs text-primary hover:underline">
                          {order.order_number}
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-56 text-sm">
                      <div className="flex items-center gap-2" title={(b.passengers ?? []).map(p => p.full_name).join(", ")}><Users className="size-4 text-muted-foreground" aria-hidden />{b.passengers?.length || "—"}</div>
                    </TableCell>
                    <TableCell className="max-w-56 text-sm">
                      <p className="truncate">{agencyCustomer?.full_name ?? customer?.full_name ?? customer?.email ?? "—"}</p>
                      <Badge variant="neutral">{b.agency_id ? "B2B" : "B2C"}</Badge>
                      {b.agency_id ? (
                        <>
                          <p className="truncate text-xs text-muted-foreground">{agency?.name ?? "Agency"}</p>
                          <p className="truncate text-xs text-muted-foreground">{bookedBy?.full_name ?? bookedBy?.email ?? "—"}</p>
                        </>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-64">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {b.ticketing_status === "failed" ? (
                        <div className="mt-2 space-y-2">
                          {b.ticketing_error ? <p className="text-xs break-words text-destructive">{b.ticketing_error}</p> : null}
                          {!b.provider_order_id ? <RetryTicketingForm bookingId={b.id} /> : null}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <p className="font-semibold">{b.provider_booking_ref ?? "—"}</p>
                      {(b.ticket_numbers ?? []).map((t) => (
                        <p key={t} className="text-muted-foreground">
                          {t}
                        </p>
                      ))}
                    </TableCell>
                    <TableCell numeric className="whitespace-nowrap tabular-nums">
                      {money(Number(b.total_price), b.currency)}
                    </TableCell>
                    <TableCell><Badge variant={order?.status === "paid" || order?.status === "completed" || order?.status === "processing" ? "success" : order?.status === "cancelled" || order?.status === "refunded" ? "neutral" : "info"}>{order ? (({paid:"Paid",processing:"Paid",completed:"Paid",pending_payment:"Awaiting payment",partially_paid:"Partially paid",held:"Held",cancelled:"Cancelled",refunded:"Refunded"} as Record<string,string>)[order.status] ?? order.status) : "No linked order"}</Badge></TableCell>
                    <TableCell numeric className="whitespace-nowrap text-xs text-muted-foreground">
                      <Clock3 className="mr-1 inline size-3.5" aria-hidden />{formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>{order ? <Button size="sm" variant="outline" aria-label={`Open order ${order.order_number}`} render={<Link href={`/admin/orders?order=${order.id}#order-${order.id}`} />}>Open <ArrowUpRight className="size-3" /></Button> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      </Card>
      {totalPages > 1 || page > 1 ? (
        <nav aria-label="Flight bookings pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className="text-primary hover:underline">Previous</Link> : <span />}
          <span>Page {page} · {count ?? 0} bookings</span>
          {page < totalPages ? <Link href={pageHref(page + 1)} className="text-primary hover:underline">Next</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
