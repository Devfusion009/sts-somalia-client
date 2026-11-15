import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

type Pool = {
  package_id: string; name: string; package_status: string;
  contact_person_name: string | null; contact_person_phone: string | null;
  departure_id: string | null; departure_date: string | null; return_date: string | null;
  departure_status: string | null; total_seats: number | null; booked_seats: number | null;
  offline_seats: number | null; available_seats: number; confirmed_seats: number; held_seats: number;
  bookings: number; customers: number;
};

export const metadata = { title: "Umrah pool" };

export default async function UmrahPoolPage() {
  await requirePlatformAdmin();
  const client = await createClient();
  const { data, error } = await (client as SupabaseClient).rpc("admin_public_umrah_pool");
  if (error) throw new Error("Umrah pool could not be loaded.");
  const rows = (data ?? []) as Pool[];
  const sum = (key: "total_seats" | "confirmed_seats" | "held_seats" | "available_seats") => rows.reduce((n, row) => n + Number(row[key] ?? 0), 0);
  return <div className="space-y-6">
    <PageHeader title="Umrah pool" actions={<Button variant="outline" render={<Link href="/admin/catalog/umrah" />}>Manage packages</Button>} />
    <StatRail><StatRailItem label="Total seats" value={sum("total_seats")} /><StatRailItem label="Confirmed seats" value={sum("confirmed_seats")} /><StatRailItem label="Checkout holds" value={sum("held_seats")} /><StatRailItem label="Seats remaining" value={sum("available_seats")} /></StatRail>
    <Card className="overflow-hidden py-0">{rows.length === 0 ? <Empty><EmptyTitle>No public Umrah packages</EmptyTitle></Empty> : <Table>
      <TableHeader><TableRow>{["Package · departure", "Status", "Responsible person", "Capacity", "Confirmed", "Held", "Offline", "Remaining", "Applicants", "Bookings", "Customers"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map(row => <TableRow key={row.departure_id ?? row.package_id}>
        <TableCell><Link className="font-medium text-primary hover:underline" href={`/admin/catalog/umrah/${row.package_id}`}>{row.name}</Link>{row.departure_id ? <Link className="mt-1 block text-xs text-muted-foreground hover:underline" href={`/admin/umrah/departures/${row.departure_id}`}>{row.departure_date} – {row.return_date}</Link> : <span className="mt-1 block text-xs text-muted-foreground">No departures</span>}</TableCell>
        <TableCell><Badge variant={statusBadgeVariant(row.package_status)}>{row.package_status}</Badge>{row.departure_status ? <span className="mt-1 block text-xs text-muted-foreground">{row.departure_status}</span> : null}</TableCell>
        <TableCell><span className="block">{row.contact_person_name ?? "—"}</span>{row.contact_person_phone ? <a className="text-xs text-primary" href={`tel:${row.contact_person_phone.replace(/[^+0-9]/g, "")}`}>{row.contact_person_phone}</a> : null}</TableCell>
        {[row.total_seats ?? 0, row.confirmed_seats, row.held_seats, row.offline_seats ?? 0, row.available_seats, row.booked_seats ?? 0, row.bookings, row.customers].map((value,index) => <TableCell key={index} className="tabular-nums">{value}</TableCell>)}
      </TableRow>)}</TableBody>
    </Table>}</Card>
  </div>;
}
