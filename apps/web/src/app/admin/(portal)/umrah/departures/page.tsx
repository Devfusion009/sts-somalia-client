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
  const from = showPast
    ? new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const departures = await getDeparturesOverview(from);

  return (
    <div className="space-y-6">
      <PageHeader title="Umrah Departures" actions={<ReleaseUnpaidButton />} />

      <FilterChips
        label="Departure range"
        active={showPast ? "past" : "upcoming"}
        items={[
          { key: "upcoming", label: "Upcoming", href: "/admin/umrah/departures" },
          { key: "past", label: "Last 6 months", href: "/admin/umrah/departures?past=1" },
        ]}
      />

      <Card className="overflow-hidden py-0">
        {departures.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>No departures</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
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
                    <TableCell className="font-medium">{d.package_name}</TableCell>
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
