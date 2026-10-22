import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getDeparturesOverview } from "@/modules/umrah/departure-admin-queries";
import { formatMoney } from "@/modules/umrah/pricing";
import { formatDay } from "../bookings/shared";
import { ReleaseUnpaidButton } from "./departure-forms";

export const metadata: Metadata = { title: "Umrah Departures" };

const STATUS_STYLES: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

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

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Umrah Departures</h1>
        <ReleaseUnpaidButton />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/umrah/departures" className={chip(!showPast)}>
          Upcoming
        </Link>
        <Link href="/admin/umrah/departures?past=1" className={chip(showPast)}>
          Last 6 months
        </Link>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Departure</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Pilgrims ready</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {departures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No departures.
                </TableCell>
              </TableRow>
            ) : (
              departures.map((d) => {
                const free = d.total_seats - d.booked_seats - d.offline_seats;
                return (
                  <TableRow key={d.departure_id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDay(d.departure_date)} – {formatDay(d.return_date)}
                    </TableCell>
                    <TableCell className="font-medium">{d.package_name}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {d.booked_seats} booked · {d.offline_seats} offline · {free} free
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className={cn(d.pilgrims_ready < d.pilgrims ? "text-brand-gold" : "")}>
                        {d.pilgrims_ready} / {d.pilgrims}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {Number(d.balance_outstanding) > 0 ? formatMoney(Number(d.balance_outstanding), d.currency) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-transparent capitalize", STATUS_STYLES[d.status] ?? "bg-muted")}>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        aria-label="Open departure"
                        render={<Link href={`/admin/umrah/departures/${d.departure_id}`} />}
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
