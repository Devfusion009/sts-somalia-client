import { OperationsMetrics } from "../../operations-ui";
import styles from "../../operations.module.css";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getDeparturesOverview } from "@/modules/umrah/departure-admin-queries";
import { formatMoney } from "@/modules/umrah/pricing";
import { formatDay } from "../bookings/shared";
import { ReleaseUnpaidButton } from "./departure-forms";

export const metadata: Metadata = { title: "Umrah Departures" };

const STATUS_OVERRIDES = { open: "success", full: "warning" } as const;

export default async function AdminUmrahDeparturesPage({
  searchParams,
}: {
  searchParams: Promise<{ past?: string }>;
}) {
  const { past } = await searchParams;
  const showPast = past === "1";
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const from = showPast
    ? new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : today;
  const overview = await getDeparturesOverview(from);
  const departures = showPast ? overview.filter((departure) => departure.departure_date < today) : overview;

  return (
    <div className={`${styles.page} space-y-6`}>
      <PageHeader title="Umrah Departures" actions={<ReleaseUnpaidButton />} />

      <OperationsMetrics items={[
        { label: showPast ? "Departures · last 6 months" : "Upcoming departures", value: departures.length },
        { label: "Booked seats", value: departures.reduce((n, d) => n + d.booked_seats, 0) },
        { label: "Offline seats", value: departures.reduce((n, d) => n + d.offline_seats, 0), tone: "warning" },
        { label: "Available seats", value: departures.reduce((n, d) => n + Math.max(0, d.total_seats - d.booked_seats - d.offline_seats), 0), tone: "primary" },
      ]} />
      <div className={styles.filters}>
      <FilterChips
        label="Departure range"
        active={showPast ? "past" : "upcoming"}
        items={[
          { key: "upcoming", label: "Upcoming", href: "/admin/umrah/departures" },
          { key: "past", label: "Last 6 months", href: "/admin/umrah/departures?past=1" },
        ]}
      />

      </div>
      <Card className={`${styles.table} overflow-hidden py-0`}>
        {departures.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>No departures</EmptyTitle>
          </Empty>
        ) : (
          <Table containerClassName="max-h-[65vh]">
            <TableHeader sticky>
              <TableRow>
                <TableHead>Departure</TableHead>
                <TableHead>Package</TableHead>
                <TableHead numeric>Booked</TableHead>
                <TableHead numeric>Offline</TableHead>
                <TableHead numeric>Free</TableHead>
                <TableHead numeric>Pilgrims ready</TableHead>
                <TableHead numeric>Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departures.map((d) => {
                const free = d.total_seats - d.booked_seats - d.offline_seats;
                return (
                  <TableRow key={d.departure_id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      <Link
                        href={`/admin/umrah/departures/${d.departure_id}`}
                        className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {formatDay(d.departure_date)}
                      </Link>
                      <p className="text-xs text-muted-foreground">to {formatDay(d.return_date)}</p>
                    </TableCell>
                    <TableCell className="min-w-52 font-medium">
                      {d.package_name}
                      <div className="mt-2 flex items-center gap-2">
                        <progress className="h-1.5 w-24 overflow-hidden rounded-full accent-primary" value={Math.min(d.total_seats, d.booked_seats + d.offline_seats)} max={Math.max(1, d.total_seats)} aria-label={`${d.package_name} seat occupancy`} />
                        <span className="text-xs font-normal text-muted-foreground">{d.booked_seats + d.offline_seats}/{d.total_seats}</span>
                      </div>
                    </TableCell>
                    <TableCell numeric>{d.booked_seats}</TableCell>
                    <TableCell numeric>{d.offline_seats}</TableCell>
                    <TableCell numeric className={cn(free <= 0 && "font-medium text-destructive")}>
                      {free}
                    </TableCell>
                    <TableCell numeric>
                      <span
                        className={cn(
                          d.pilgrims_ready < d.pilgrims &&
                            "font-medium text-[color-mix(in_oklch,var(--brand-gold),black_40%)] dark:text-brand-gold"
                        )}
                      >
                        {d.pilgrims_ready} / {d.pilgrims}
                      </span>
                    </TableCell>
                    <TableCell numeric className="whitespace-nowrap">
                      {Number(d.balance_outstanding) > 0 ? (
                        formatMoney(Number(d.balance_outstanding), d.currency)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(d.status, STATUS_OVERRIDES)} className="capitalize">
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell numeric>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Open departure"
                        title="Open"
                        render={<Link href={`/admin/umrah/departures/${d.departure_id}`} />}
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
    </div>
  );
}
