import Link from "next/link";
import { CalendarDays, Building2, Package, Users, ArrowRight } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { UmrahPackageForm } from "../../catalog/umrah/umrah-package-form";
import { poolCapacity, poolStatus, type UmrahPoolRow } from "@/modules/umrah/pool";

export const metadata = { title: "Umrah pool" };
const date = (value: string | null) => value ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}) : "—";

export default async function UmrahPoolPage() {
  await requirePlatformAdmin();
  const client = await createClient();
  const [{ data, error }, airports, requestFirstEnabled] = await Promise.all([
    client.rpc("admin_public_umrah_pool"),
    (await getServerTrpc()).flights.airports.query(),
    (await getServerTrpc()).umrah.poolRequests.enabled.query(),
  ]);
  if (error) throw new Error("Umrah pool could not be loaded.");
  const rows = (data ?? []) as unknown as UmrahPoolRow[];
  const totals = rows.reduce((sum,row) => { const c=poolCapacity(row); return {total:sum.total+c.total,filled:sum.filled+c.filled,held:sum.held+c.held,remaining:sum.remaining+c.remaining}; }, {total:0,filled:0,held:0,remaining:0});
  return <div className="space-y-6">
    <PageHeader title="Umrah pool" actions={<UmrahPackageForm airports={airports} requestFirstEnabled={requestFirstEnabled} />} />
    <StatRail><StatRailItem label="Total capacity" value={totals.total} /><StatRailItem label="Filled" value={totals.filled} /><StatRailItem label="Held" value={totals.held} /><StatRailItem label="Remaining" value={totals.remaining} /></StatRail>
    <Card className="overflow-hidden py-0">{rows.length === 0 ? <Empty><EmptyTitle>No Umrah pools</EmptyTitle></Empty> : <Table>
      <TableHeader><TableRow>{["Package", "Travel dates", "Organizer", "Capacity", "Status", "Action"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map(row => {
        const capacity=poolCapacity(row), status=poolStatus(row);
        return <TableRow key={row.departure_id ?? row.package_id}>
          <TableCell><div className="flex items-start gap-3">{row.pool_visibility === "private" ? <Users className="mt-1 size-5 text-primary" aria-hidden /> : <Package className="mt-1 size-5 text-primary" aria-hidden />}<div><Link className="font-semibold hover:underline" href={`/admin/umrah/pool/${row.package_id}`}>{row.name}</Link><div className="mt-1"><Badge variant={row.pool_visibility === "private" ? "info" : "success"}>{row.pool_visibility === "private" ? "Private" : "Public"}</Badge></div></div></div></TableCell>
          <TableCell><div className="flex items-start gap-2 text-sm"><CalendarDays className="mt-0.5 size-4 text-muted-foreground" aria-hidden /><div>{date(row.departure_date)}<span className="block text-muted-foreground">{date(row.return_date)}</span></div></div></TableCell>
          <TableCell><div className="flex items-center gap-2 font-medium"><Building2 className="size-4 text-muted-foreground" aria-hidden />{row.organizer_name}</div><div className="mt-1 text-xs text-muted-foreground">{row.contact_person_name ?? "—"}</div>{row.contact_person_phone ? <a className="block text-xs text-primary" href={`tel:${row.contact_person_phone.replace(/[^+0-9]/g,"")}`}>{row.contact_person_phone}</a> : null}{row.contact_person_email ? <a className="block text-xs text-primary" href={`mailto:${row.contact_person_email}`}>{row.contact_person_email}</a> : null}</TableCell>
          <TableCell className="min-w-56"><div className="mb-2 font-semibold tabular-nums">{row.booking_mode === "request_then_pay" ? capacity.filled + capacity.held : capacity.filled} / {capacity.total} {row.booking_mode === "request_then_pay" ? "allocated" : "filled"}</div><Progress value={row.booking_mode === "request_then_pay" && capacity.total ? (capacity.filled+capacity.held)/capacity.total*100 : capacity.percent} aria-label={`${row.name} filled capacity`} /><div className="mt-2 text-xs text-muted-foreground tabular-nums">{capacity.remaining} remaining · {row.booking_mode === "request_then_pay" ? `${capacity.filled} paid · ${capacity.held} unpaid` : `${capacity.held} held`}</div>{Number(row.offline_seats)>0 ? <div className="text-xs text-muted-foreground">{row.offline_seats} offline sales</div> : null}</TableCell>
          <TableCell><Badge variant={status === "Open" ? "success" : status === "Private" ? "warning" : "neutral"}>{status}</Badge></TableCell>
          <TableCell><div className="flex flex-col items-start gap-2"><Button size="sm" variant="outline" render={<Link href={`/admin/umrah/pool/${row.package_id}`} />}>Manage <ArrowRight className="size-3" /></Button>{row.departure_id ? <Link className="text-xs text-primary hover:underline" href={`/admin/umrah/departures/${row.departure_id}`}>{row.bookings} bookings · {row.customers} customers</Link> : null}</div></TableCell>
        </TableRow>;
      })}</TableBody>
    </Table>}</Card>
  </div>;
}
