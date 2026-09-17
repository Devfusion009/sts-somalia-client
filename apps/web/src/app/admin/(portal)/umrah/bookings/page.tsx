import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUmrahBookingsAdmin } from "@/modules/umrah/fulfillment-admin-queries";
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

export default async function AdminUmrahBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage: rawStage } = await searchParams;
  const stage = isUmrahStage(rawStage) ? rawStage : undefined;
  const bookings = await getUmrahBookingsAdmin(stage);

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
    );

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Umrah Bookings</h1>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/umrah/bookings" className={chip(!stage)}>
          All
        </Link>
        {UMRAH_STAGES.map((s) => (
          <Link key={s} href={`/admin/umrah/bookings?stage=${s}`} className={chip(stage === s)}>
            {UMRAH_STAGE_LABELS[s]}
          </Link>
        ))}
      </div>

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
                  {stage ? `No bookings at "${UMRAH_STAGE_LABELS[stage]}".` : "No Umrah bookings yet."}
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
                      <p className="font-medium">{b.customer?.full_name ?? "—"}</p>
                      {b.customer?.email ? <p className="text-xs text-muted-foreground">{b.customer.email}</p> : null}
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
    </div>
  );
}
