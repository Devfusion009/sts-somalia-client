import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getUmrahBookingsAdmin,
  getUmrahFilterOptions,
  type UmrahPaymentFilter,
} from "@/modules/umrah/fulfillment-admin-queries";
import { Pager } from "@/components/dashboard/pager";
import { parsePage } from "@/lib/pagination";
import { formatMoney } from "@/modules/umrah/pricing";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  UMRAH_STAGES,
  UMRAH_STAGE_LABELS,
  isPaidOrderStatus,
  isUmrahStage,
} from "./stages";
import { StageBadge, formatDay } from "./shared";

export const metadata: Metadata = { title: "Umrah Bookings" };

const PAYMENT_FILTERS: { value: UmrahPaymentFilter; label: string }[] = [
  { value: "unpaid", label: "Awaiting payment" },
  { value: "partial", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Cancelled or refunded" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const selectClass =
  "border-input h-8 rounded-md border bg-transparent px-2.5 text-xs shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
    );

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Umrah Bookings</h1>

      <div className="flex flex-wrap gap-2">
        <Link href={hrefWith({ stage: undefined })} className={chip(!stage)}>
          All
        </Link>
        {UMRAH_STAGES.map((s) => (
          <Link key={s} href={hrefWith({ stage: s })} className={chip(stage === s)}>
            {UMRAH_STAGE_LABELS[s]}
          </Link>
        ))}
      </div>

      <form method="get" action="/admin/umrah/bookings" className="flex flex-wrap items-center gap-2">
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
        <Button type="submit" size="sm" variant="outline" className="h-8">
          Filter
        </Button>
      </form>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Pilgrims</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  No matching bookings.
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((b) => {
                const departureDate = b.departure?.departure_date ?? b.custom_request?.departure_date ?? null;
                const orderStatus = b.order?.status ?? null;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.order?.order_number ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {b.booking_kind}
                        </Badge>
                        <span className="font-medium">
                          {b.booking_kind === "group"
                            ? (b.package?.name ?? "—")
                            : (b.custom_request?.reference ?? "—")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDay(departureDate)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{b.guest?.full_name ?? b.customer?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.guest ? `Booked by ${b.agency?.name ?? b.customer?.full_name ?? "agent"}` : (b.customer?.email ?? "")}
                      </p>
                    </TableCell>
                    <TableCell>{b.num_pilgrims}</TableCell>
                    <TableCell className="tabular-nums">{formatMoney(b.total_price, b.currency)}</TableCell>
                    <TableCell>
                      {orderStatus ? (
                        <Badge
                          className={cn(
                            "border-transparent",
                            isPaidOrderStatus(orderStatus)
                              ? "bg-primary/10 text-primary"
                              : orderStatus === "cancelled" || orderStatus === "refunded"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-brand-gold/15 text-brand-gold"
                          )}
                        >
                          {ORDER_STATUS_LABELS[orderStatus] ?? orderStatus}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">No order</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={b.fulfillment_stage} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        aria-label="Open booking"
                        render={<Link href={`/admin/umrah/bookings/${b.id}`} />}
                      >
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
      <Pager page={page} total={total} hrefFor={(n) => `${hrefWith({})}${hrefWith({}).includes("?") ? "&" : "?"}page=${n}`} />
    </div>
  );
}
