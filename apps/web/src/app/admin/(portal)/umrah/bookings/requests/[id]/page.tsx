import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { POOL_REQUEST_LABELS } from "@sts/shared-types";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getServerTrpc, TRPCClientError } from "@/lib/trpc/server";
import { getSelectedUmrahCapacityAdmin } from "@/modules/umrah/fulfillment-admin-queries";
import { poolCapacity } from "@/modules/umrah/pool";
import { formatMoney } from "@/modules/umrah/pricing";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { formatDay } from "../../shared";
import { PoolAdminOperation } from "@/modules/umrah/components/pool-configuration";

export const metadata: Metadata = { title: "Umrah Pool Request" };

export default async function AdminUmrahRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  let request;
  try {
    request = await (await getServerTrpc({ timeoutMs: 15000 })).umrah.poolRequests.get.query({ requestId: id });
  } catch (error) {
    if (error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { customer, agency, booking_id: bookingId, room_sharing: roomSharing, special_requests: specialRequests } = request as typeof request & {
    customer?: { full_name: string | null; email: string | null } | null;
    agency?: { name: string } | null;
    booking_id?: string | null;
    room_sharing?: number | null;
    special_requests?: string;
  };
  const pool = (await getSelectedUmrahCapacityAdmin([request.departure_id]))[0] ?? null;
  const capacity = pool ? poolCapacity(pool) : null;

  return <div className="space-y-6">
    <BackLink href="/admin/umrah/bookings" label="Umrah orders" />
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><h1 className="font-heading text-2xl font-semibold">{request.reference}</h1><Badge variant={request.status === "requested" ? "warning" : request.status === "paid" ? "success" : "neutral"}>{POOL_REQUEST_LABELS[request.status]}</Badge></div><p className="font-medium">{request.quote_snapshot.packageName}</p></div>
      <div className="flex flex-wrap gap-2">
        {pool?.formation_status === "activation_pending" && capacity?.remaining === 0 ? <PoolAdminOperation operation="confirm" target={request.departure_id} label="Confirm group & invite payment" /> : null}
        {pool ? <Button variant="outline" render={<Link href={`/admin/umrah/pool/${pool.package_id}`} />}>Manage pool <ArrowRight className="size-4" aria-hidden="true" /></Button> : null}
        {bookingId ? <Button variant="outline" render={<Link href={`/admin/umrah/bookings/${bookingId}`} />}>Booking details</Button> : null}
        {request.order_id ? <Button render={<Link href={`/admin/orders/${request.order_id}`} />}>Order & payment</Button> : null}
      </div>
    </header>
    <StatRail><StatRailItem label="Pool capacity" value={capacity?.total ?? "—"} /><StatRailItem label="Filled" value={capacity?.filled ?? "—"} /><StatRailItem label="Held" value={capacity?.held ?? "—"} /><StatRailItem label="Available" value={capacity?.remaining ?? "—"} /></StatRail>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardContent className="space-y-4"><h2 className="font-heading text-base font-semibold">Request details</h2><dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Customer</dt><dd className="font-medium">{customer?.full_name || "Customer"}</dd><dd className="text-sm text-muted-foreground">{customer?.email}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Source</dt><dd className="font-medium">{agency?.name ? `Agency · ${agency.name}` : "B2C customer"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Travel dates</dt><dd className="font-medium tabular-nums">{formatDay(request.quote_snapshot.departureDate)} – {formatDay(request.quote_snapshot.returnDate)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Requested places</dt><dd className="font-medium tabular-nums">{request.num_pilgrims}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Room sharing</dt><dd className="font-medium">{roomSharing ? `${roomSharing} per room` : "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Price per person</dt><dd className="font-medium tabular-nums">{formatMoney(request.unit_price, request.currency)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="font-semibold tabular-nums">{formatMoney(request.total, request.currency)}</dd></div>
        {request.payment_due_at ? <div><dt className="text-xs text-muted-foreground">Payment due</dt><dd className="font-medium tabular-nums">{new Date(request.payment_due_at).toLocaleString("en-GB", { timeZone: "Africa/Mogadishu" })} EAT</dd></div> : null}
      </dl>{specialRequests ? <div><h3 className="text-xs font-medium text-muted-foreground">Special requests</h3><p className="whitespace-pre-wrap text-sm">{specialRequests}</p></div> : null}{request.closed_reason ? <p className="text-sm text-destructive">{request.closed_reason}</p> : null}</CardContent></Card>
      <Card><CardContent className="space-y-4"><h2 className="font-heading text-base font-semibold">Travelers</h2><ul className="divide-y divide-border">{request.travelers.map((traveler) => <li key={traveler.id} className="flex justify-between gap-4 py-2 text-sm"><span className="font-medium">{traveler.full_name}</span><span className="capitalize text-muted-foreground">{traveler.gender}</span></li>)}</ul></CardContent></Card>
    </div>
    <Card><CardContent className="space-y-3"><h2 className="font-heading text-base font-semibold">Accepted pool terms</h2><p className="whitespace-pre-wrap text-sm">{request.quote_snapshot.terms}</p></CardContent></Card>
  </div>;
}
