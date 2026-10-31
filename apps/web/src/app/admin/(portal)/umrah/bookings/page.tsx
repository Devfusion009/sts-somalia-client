import styles from "../../operations.module.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Landmark } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export const metadata: Metadata = { title: "Umrah Bookings" };

const PAYMENT_FILTERS: { value: UmrahPaymentFilter; label: string }[] = [
  { value: "unpaid", label: "Awaiting payment" },
  { value: "partial", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Cancelled or refunded" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const selectClass = cn(NATIVE_SELECT_CLASS, "w-full min-w-0 bg-card shadow-none");

export default async function AdminUmrahBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; departure?: string; package?: string; payment?: string; page?: string }>;
}) {
  const params = await searchParams;
  const stage = isUmrahStage(params.stage) ? params.stage : undefined;
  const departureId = params.departure && UUID.test(params.departure) ? params.departure : undefined;
  const packageId = params.package && UUID.test(params.package) ? params.package : undefined;
  const payment = PAYMENT_FILTERS.some((f) => f.value === params.payment)
    ? (params.payment as UmrahPaymentFilter)
    : undefined;
  const page = parsePage(params.page);
  const [{ bookings, total }, options] = await Promise.all([
    getUmrahBookingsAdmin({ stage, departureId, packageId, payment, page }),
    getUmrahFilterOptions(),
  ]);

  const hrefWith = (next: Record<string, string | undefined>) => {
    const merged = { stage, departure: departureId, package: packageId, payment, ...next };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== "")
    ).toString();
    return `/admin/umrah/bookings${qs ? `?${qs}` : ""}`;
  };

  const filtered = Boolean(stage || departureId || packageId || payment);

  return (
    <div className={`${styles.page} space-y-6`}>
      <PageHeader
        title="Umrah Bookings"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {total.toLocaleString("en-US")}
          </Badge>
        }
      />

      <div className={styles.filters}>
      <FilterChips
        label="Filter by stage"
        active={stage ?? "all"}
        items={[
          { key: "all", label: "All", href: hrefWith({ stage: undefined }) },
          ...UMRAH_STAGES.map((s) => ({ key: s, label: UMRAH_STAGE_LABELS[s], href: hrefWith({ stage: s }) })),
        ]}
      />

      <form method="get" action="/admin/umrah/bookings" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1fr_auto]">
        {stage ? <input type="hidden" name="stage" value={stage} /> : null}
        <select name="package" defaultValue={packageId ?? ""} className={selectClass} aria-label="Package">
          <option value="">All packages</option>
          {options.packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="departure" defaultValue={departureId ?? ""} className={selectClass} aria-label="Departure">
          <option value="">All departures</option>
          {options.departures.map((d) => (
            <option key={d.id} value={d.id}>
              {formatDay(d.departure_date)} · {d.package?.name ?? "Umrah"}
            </option>
          ))}
        </select>
        <select name="payment" defaultValue={payment ?? ""} className={selectClass} aria-label="Payment">
          <option value="">Any payment</option>
          {PAYMENT_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Button type="submit">Apply</Button>
          {filtered ? <Button variant="ghost" render={<Link href="/admin/umrah/bookings" />}>Reset</Button> : null}
        </div>
      </form>
      </div>

      <Card className={`${styles.table} overflow-hidden py-0`}>
        {bookings.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Landmark />
            </EmptyMedia>
            <EmptyTitle>{filtered ? "No bookings match these filters" : "No Umrah bookings"}</EmptyTitle>
          </Empty>
        ) : (
          <Table containerClassName="max-h-[65vh]">
            <TableHeader sticky>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead numeric>Pilgrims</TableHead>
                <TableHead numeric>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => {
                const departureDate = b.departure?.departure_date ?? b.custom_request?.departure_date ?? null;
                const orderStatus = b.order?.status ?? null;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs text-primary">
                      <Link
                        href={`/admin/umrah/bookings/${b.id}`}
                        className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {b.order?.order_number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral" className="capitalize">
                          {b.booking_kind}
                        </Badge>
                        <span className="font-medium">
                          {b.booking_kind === "group"
                            ? (b.package?.name ?? "—")
                            : (b.custom_request?.reference ?? "—")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatDay(departureDate)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{b.guest?.full_name ?? b.customer?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.guest ? `Booked by ${b.agency?.name ?? b.customer?.full_name ?? "agent"}` : (b.customer?.email ?? "")}
                      </p>
                    </TableCell>
                    <TableCell numeric>{b.num_pilgrims}</TableCell>
                    <TableCell numeric className="whitespace-nowrap">
                      {formatMoney(b.total_price, b.currency)}
                    </TableCell>
                    <TableCell>
                      {orderStatus ? (
                        <Badge variant={orderStatusVariant(orderStatus)}>
                          {ORDER_STATUS_LABELS[orderStatus] ?? orderStatus}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">No order</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={b.fulfillment_stage} />
                    </TableCell>
                    <TableCell numeric>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Open booking"
                        title="Open"
                        render={<Link href={`/admin/umrah/bookings/${b.id}`} />}
                      >
                        <ChevronRight />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pager page={page} total={total} hrefFor={(n) => `${hrefWith({})}${hrefWith({}).includes("?") ? "&" : "?"}page=${n}`} />
    </div>
  );
}
