import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, CreditCard, Landmark, Layers3, Package, SlidersHorizontal, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getUmrahBookingsAdmin,
  getUmrahFilterOptions,
  getSelectedUmrahCapacityAdmin,
  type UmrahPaymentFilter,
} from "@/modules/umrah/fulfillment-admin-queries";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { formatMoney } from "@/modules/umrah/pricing";
import {
  ORDER_STATUS_LABELS,
  UMRAH_STAGES,
  UMRAH_STAGE_LABELS,
  isUmrahStage,
  orderStatusVariant,
} from "./stages";
import { StageBadge, formatDay } from "./shared";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/server";
import { POOL_REQUEST_LABELS } from "@sts/shared-types";
import { poolCapacity } from "@/modules/umrah/pool";

export const metadata: Metadata = { title: "Umrah bookings & requests" };

const PAYMENT_FILTERS: { value: UmrahPaymentFilter; label: string }[] = [
  { value: "unpaid", label: "Awaiting payment" },
  { value: "partial", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Cancelled or refunded" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const selectClass = `${NATIVE_SELECT_CLASS} w-full min-w-0 bg-card pl-9`;

export default async function AdminUmrahBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; departure?: string; package?: string; payment?: string; page?: string; requestPage?: string }>;
}) {
  const params = await searchParams;
  const stage = isUmrahStage(params.stage) ? params.stage : undefined;
  const departureId = params.departure && UUID.test(params.departure) ? params.departure : undefined;
  const packageId = params.package && UUID.test(params.package) ? params.package : undefined;
  const payment = PAYMENT_FILTERS.some((f) => f.value === params.payment)
    ? (params.payment as UmrahPaymentFilter)
    : undefined;
  const page = parsePage(params.page);
  const requestPage = parsePage(params.requestPage);
  const [{ bookings, total }, options] = await Promise.all([
    getUmrahBookingsAdmin({ stage, departureId, packageId, payment, page }),
    getUmrahFilterOptions(),
  ]);
  type RequestContact = { customer?: { full_name: string | null; email: string | null } | null; agency?: { name: string } | null };
  type RequestRow = RequestContact & { id: string; reference: string; departure_id: string; status: keyof typeof POOL_REQUEST_LABELS; num_pilgrims: number; quote_snapshot: {packageName:string;departureDate:string;returnDate:string} };
  let requestOnly: RequestRow[] = [];
  let requestTotal = 0;
  if (!stage && !payment) {
    let query = (await createClient()).from("umrah_pool_requests")
      .select("id,reference,departure_id,status,num_pilgrims,quote_snapshot,customer:profiles!umrah_pool_requests_customer_id_fkey(full_name,email),agency:agencies!umrah_pool_requests_agency_id_fkey(name),departure:umrah_package_departures!inner(package_id)", { count: "exact" })
      .is("order_id", null).order("created_at", { ascending: false }).order("id");
    if (departureId) query = query.eq("departure_id", departureId);
    if (packageId) query = query.eq("departure.package_id", packageId);
    const { data, count, error } = await query.range((requestPage - 1) * 50, requestPage * 50 - 1);
    if (error) throw new Error("Umrah requests could not be loaded.");
    requestOnly = (data ?? []) as unknown as RequestRow[];
    requestTotal = count ?? 0;
  }
  const selectedCapacity = await getSelectedUmrahCapacityAdmin(requestOnly.map((request) => request.departure_id));
  const poolsByDeparture = new Map(selectedCapacity.map((pool) => [pool.departure_id, pool]));

  const hrefWith = (next: Record<string, string | undefined>) => {
    const merged = { stage, departure: departureId, package: packageId, payment, ...next };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== "")
    ).toString();
    return `/admin/umrah/bookings${qs ? `?${qs}` : ""}`;
  };

  const filtered = Boolean(stage || departureId || packageId || payment);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Package className="size-5" aria-hidden="true" /></span>Umrah bookings & requests</span>}
        status={
          <Badge variant="success" className="tabular-nums">
            {(total + requestTotal).toLocaleString("en-US")}
          </Badge>
        }
      />

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
      <FilterChips
        label="Filter by stage"
        active={stage ?? "all"}
        className="[&>a]:rounded-lg"
        items={[
          { key: "all", label: "All", href: hrefWith({ stage: undefined }) },
          ...UMRAH_STAGES.map((s) => ({ key: s, label: UMRAH_STAGE_LABELS[s], href: hrefWith({ stage: s }) })),
        ]}
      />

      <form method="get" action="/admin/umrah/bookings" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1fr_auto]">
        {stage ? <input type="hidden" name="stage" value={stage} /> : null}
        <div className="relative"><Layers3 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><select name="package" defaultValue={packageId ?? ""} className={selectClass} aria-label="Package">
          <option value="">All packages</option>
          {options.packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select></div>
        <div className="relative"><CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><select name="departure" defaultValue={departureId ?? ""} className={selectClass} aria-label="Departure">
          <option value="">All departures</option>
          {options.departures.map((d) => (
            <option key={d.id} value={d.id}>
              {formatDay(d.departure_date)} · {d.package?.name ?? "Umrah"}
            </option>
          ))}
        </select></div>
        <div className="relative"><CreditCard className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><select name="payment" defaultValue={payment ?? ""} className={selectClass} aria-label="Payment">
          <option value="">Any payment</option>
          {PAYMENT_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select></div>
        <div className="flex items-center gap-2">
          <Button type="submit"><SlidersHorizontal className="size-4" aria-hidden="true" /> Apply</Button>
          {filtered ? <Button variant="ghost" render={<Link href="/admin/umrah/bookings" />}>Reset</Button> : null}
        </div>
      </form>
      </div>

      {requestTotal > 0 ? <section className="space-y-3" aria-labelledby="pool-requests-title">
        <div className="flex items-center gap-2"><h2 id="pool-requests-title" className="font-heading text-lg font-semibold">Pool requests</h2><Badge variant="warning" className="tabular-nums">{requestTotal}</Badge></div>
        <Card className="overflow-hidden py-0 ring-1 ring-border">
          <Table containerClassName="overflow-x-auto" className="min-w-[920px]">
            <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Package and departure</TableHead><TableHead>Customer</TableHead><TableHead numeric>Places</TableHead><TableHead>Pool availability</TableHead><TableHead>Status</TableHead><TableHead numeric>Action</TableHead></TableRow></TableHeader>
            <TableBody>{requestOnly.map((request) => {
              const pool = poolsByDeparture.get(request.departure_id);
              const capacity = pool ? poolCapacity(pool) : null;
              return <TableRow key={request.id} className="hover:bg-primary/[0.04]">
                <TableCell className="py-4 font-mono text-xs font-semibold text-primary"><Link href={`/admin/umrah/bookings/requests/${request.id}`} className="hover:underline">{request.reference}</Link></TableCell>
                <TableCell className="py-4 whitespace-normal"><span className="font-semibold">{request.quote_snapshot.packageName}</span><span className="block text-xs text-muted-foreground">{formatDay(request.quote_snapshot.departureDate)} – {formatDay(request.quote_snapshot.returnDate)}</span></TableCell>
                <TableCell className="py-4 whitespace-normal"><span className="font-medium">{request.customer?.full_name || "Customer"}</span><span className="block max-w-48 truncate text-xs text-muted-foreground" title={request.customer?.email ?? undefined}>{request.agency?.name ? `Booked by ${request.agency.name}` : request.customer?.email}</span></TableCell>
                <TableCell numeric className="py-4 font-semibold">{request.num_pilgrims}</TableCell>
                <TableCell className="py-4"><span className="font-semibold tabular-nums">{capacity ? `${capacity.remaining} / ${capacity.total} available` : "—"}</span>{capacity ? <span className="block text-xs text-muted-foreground">{capacity.filled} filled · {capacity.held} held</span> : null}</TableCell>
                <TableCell className="py-4"><Badge variant={request.status === "requested" ? "warning" : "neutral"}>{POOL_REQUEST_LABELS[request.status]}</Badge></TableCell>
                <TableCell numeric className="py-4"><Button size="sm" variant="outline" render={<Link href={`/admin/umrah/bookings/requests/${request.id}`} />}>Review <ArrowRight className="size-4" aria-hidden="true" /></Button></TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </Card>
        <Pager page={requestPage} total={requestTotal} pageSize={50} hrefFor={(n) => `${hrefWith({})}${hrefWith({}).includes("?") ? "&" : "?"}requestPage=${n}`} />
      </section> : null}

      <section className="space-y-3" aria-labelledby="booked-orders-title"><h2 id="booked-orders-title" className="font-heading text-lg font-semibold">Bookings and payments</h2>
      <Card className="overflow-hidden py-0 ring-1 ring-border">
        {bookings.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Landmark />
            </EmptyMedia>
            <EmptyTitle>{filtered ? "No bookings match these filters" : "No Umrah bookings yet"}</EmptyTitle>
          </Empty>
        ) : (
          <Table containerClassName="overflow-x-auto" className="min-w-[1000px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead numeric>Pilgrims</TableHead>
                <TableHead numeric>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead numeric>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => {
                const departureDate = b.departure?.departure_date ?? b.custom_request?.departure_date ?? null;
                const orderStatus = b.order?.status ?? null;
                return (
                  <TableRow key={b.id} className="hover:bg-primary/[0.04]">
                    <TableCell className="py-4 font-mono text-xs font-semibold text-primary">
                      <Link
                        href={`/admin/umrah/bookings/${b.id}`}
                        className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {b.order?.order_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-64 py-4 whitespace-normal">
                      <div className="flex items-start gap-2">
                        <Badge variant="neutral" className="mt-0.5 capitalize">
                          {b.booking_kind}
                        </Badge>
                        <span className="max-w-80 font-semibold leading-snug">
                          {b.booking_kind === "group"
                            ? (b.package?.name ?? "—")
                            : (b.custom_request?.reference ?? "—")}
                        </span>
                      </div>
                      <div className="mt-1.5 pl-14"><StageBadge stage={b.fulfillment_stage} /></div>
                    </TableCell>
                    <TableCell className="py-4 whitespace-nowrap tabular-nums">{formatDay(departureDate)}</TableCell>
                    <TableCell className="max-w-56 py-4 whitespace-normal">
                      <p className="flex items-center gap-2 font-semibold"><UserRound className="size-4 shrink-0 text-primary" aria-hidden="true" />{b.guest?.full_name ?? b.customer?.full_name ?? "—"}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground" title={b.guest ? `Booked by ${b.agency?.name ?? b.customer?.full_name ?? "agent"}` : (b.customer?.email ?? "")}>
                        {b.guest ? `Booked by ${b.agency?.name ?? b.customer?.full_name ?? "agent"}` : (b.customer?.email ?? "")}
                      </p>
                    </TableCell>
                    <TableCell numeric className="py-4 font-medium">{b.num_pilgrims}</TableCell>
                    <TableCell numeric className="py-4 font-semibold whitespace-nowrap">
                      {formatMoney(b.total_price, b.currency)}
                    </TableCell>
                    <TableCell className="py-4">
                      {orderStatus ? (
                        <Badge variant={orderStatusVariant(orderStatus)} className="h-7 px-3">
                          {ORDER_STATUS_LABELS[orderStatus] ?? orderStatus}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">No order</span>
                      )}
                    </TableCell>
                    <TableCell numeric className="py-4">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Open booking ${b.order?.order_number ?? b.id}`}
                        render={<Link href={`/admin/umrah/bookings/${b.id}`} />}
                      >
                        View <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      </section>
      <Pager page={page} total={total} hrefFor={(n) => `${hrefWith({})}${hrefWith({}).includes("?") ? "&" : "?"}page=${n}`} />
    </div>
  );
}
