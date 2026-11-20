"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, Package, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { poolCapacity, poolStatus, type UmrahPoolRow } from "@/modules/umrah/pool";

const date = (value: string | null) => value
  ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
  : "—";

function StatusBadge({ row }: { row: UmrahPoolRow }) {
  const status = poolStatus(row);
  const label = status === "Private" ? "Agency only" : status;
  return <Badge variant={status === "Open" || status === "Payment open" ? "success" : status === "Forming" || status === "Group full" ? "warning" : "neutral"} className="capitalize">{label}</Badge>;
}

function PackageCell({ row }: { row: UmrahPoolRow }) {
  const agencyOnly = row.pool_visibility === "private";
  const Icon = agencyOnly ? Users : Package;
  return <div className="flex min-w-0 items-center gap-3">
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
    <div className="min-w-0">
      <Link href={`/admin/umrah/pool/${row.package_id}`} className="font-semibold text-foreground hover:text-primary hover:underline">{row.name}</Link>
      <div className="mt-1"><Badge variant={agencyOnly ? "info" : "success"}>{agencyOnly ? "Agency pool" : "Public"}</Badge></div>
    </div>
  </div>;
}

function DatesCell({ row }: { row: UmrahPoolRow }) {
  return <div className="flex items-start gap-2 text-sm tabular-nums">
    <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
    <div><span className="font-medium">{date(row.departure_date)}</span><span className="block text-muted-foreground">{date(row.return_date)}</span></div>
  </div>;
}

function OrganizerCell({ row }: { row: UmrahPoolRow }) {
  return <div className="min-w-0 text-sm">
    <div className="flex items-center gap-2 font-semibold"><Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />{row.organizer_name}</div>
    {row.contact_person_name ? <div className="mt-1 text-muted-foreground">{row.contact_person_name}</div> : null}
    {row.contact_person_phone ? <a className="block w-fit text-primary hover:underline" href={`tel:${row.contact_person_phone.replace(/[^+0-9]/g, "")}`}>{row.contact_person_phone}</a> : null}
    {row.contact_person_email ? <a className="block w-fit max-w-56 truncate text-primary hover:underline" href={`mailto:${row.contact_person_email}`}>{row.contact_person_email}</a> : null}
  </div>;
}

function CapacityCell({ row }: { row: UmrahPoolRow }) {
  const capacity = poolCapacity(row);
  const requestFirst = row.booking_mode === "request_then_pay";
  const occupied = requestFirst ? capacity.filled + capacity.held : capacity.filled;
  return <div className="min-w-48 max-w-64">
    <div className="font-semibold tabular-nums text-foreground">{occupied} / {capacity.total} {requestFirst ? "allocated" : "filled"}</div>
    <Progress className="mt-2" value={capacity.total ? occupied / capacity.total * 100 : 0} aria-label={`${row.name}: ${occupied} of ${capacity.total} seats ${requestFirst ? "allocated" : "filled"}`} />
    <div className="mt-2 text-xs tabular-nums text-muted-foreground">{capacity.remaining} remaining · {requestFirst ? `${capacity.filled} paid · ${capacity.held} unpaid` : `${capacity.held} held`}</div>
    {Number(row.offline_seats) > 0 ? <div className="mt-0.5 text-xs text-muted-foreground">{row.offline_seats} offline sales</div> : null}
  </div>;
}

function ActionCell({ row }: { row: UmrahPoolRow }) {
  return <div className="flex flex-col items-start gap-2">
    <Button size="sm" variant="outline" render={<Link href={`/admin/umrah/pool/${row.package_id}`} />} className="gap-2 font-semibold">Manage <ArrowRight className="size-4" aria-hidden="true" /></Button>
    {row.departure_id ? <Link className="text-xs font-medium tabular-nums text-primary hover:underline" href={`/admin/umrah/departures/${row.departure_id}`}>{row.bookings} bookings · {row.customers} customers</Link> : null}
  </div>;
}

export function PoolList({ rows }: { rows: UmrahPoolRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const statuses = useMemo(() => [...new Set(rows.map((row) => poolStatus(row)))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || [row.name, row.organizer_name, row.contact_person_name, row.contact_person_email]
      .some((value) => value?.toLocaleLowerCase().includes(query));
    return matchesSearch && (statusFilter === "all" || poolStatus(row) === statusFilter);
  }), [rows, search, statusFilter]);

  return <section className="space-y-4" aria-label="Umrah packages">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input aria-label="Search Umrah packages" placeholder="Search packages or organizers" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor="pool-status" className="text-sm font-medium">Status</label>
        <select id="pool-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={`${NATIVE_SELECT_CLASS} min-w-40`}>
          <option value="all">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{status === "Private" ? "Agency only" : status}</option>)}
        </select>
      </div>
    </div>

    {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">{rows.length === 0 ? "No Umrah pools yet." : "No packages match these filters."}</div> : <>
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-muted/30 p-3 lg:block">
        <table className="w-full min-w-[1050px] border-separate border-spacing-y-2 text-left text-sm">
          <thead><tr className="text-xs font-semibold text-muted-foreground">{["Package", "Travel dates", "Organizer", "Capacity", "Status", "Action"].map((label) => <th key={label} scope="col" className="px-4 pb-1 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{filtered.map((row) => <tr key={row.departure_id ?? row.package_id} className="group bg-card shadow-xs [&>td]:border-y [&>td]:border-border [&>td]:px-4 [&>td]:py-5 [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r hover:[&>td]:border-primary/40 hover:[&>td]:bg-primary/[0.025]">
            <td className="w-[25%]"><PackageCell row={row} /></td>
            <td className="w-[16%]"><DatesCell row={row} /></td>
            <td className="w-[19%]"><OrganizerCell row={row} /></td>
            <td className="w-[19%]"><CapacityCell row={row} /></td>
            <td className="w-[10%]"><StatusBadge row={row} /></td>
            <td className="w-[11%]"><ActionCell row={row} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="grid gap-3 lg:hidden">{filtered.map((row) => <article key={row.departure_id ?? row.package_id} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3"><PackageCell row={row} /><StatusBadge row={row} /></div>
        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2"><DatesCell row={row} /><OrganizerCell row={row} /></div>
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4"><CapacityCell row={row} /><ActionCell row={row} /></div>
      </article>)}</div>
    </>}
  </section>;
}
