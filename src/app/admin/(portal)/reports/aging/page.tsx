import Link from "next/link";
import { Download, TrendingDown } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAgencyAgingReport, type AgencyAgingBucket } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const BUCKET_STYLES: Record<AgencyAgingBucket, string> = {
  "0-7": "bg-muted text-muted-foreground",
  "8-30": "bg-chart-3/10 text-chart-3",
  "31-60": "bg-brand-gold/15 text-brand-gold",
  "60+": "bg-destructive/10 text-destructive",
};

const BUCKET_LABELS: Record<AgencyAgingBucket, string> = {
  "0-7": "0-7 days",
  "8-30": "8-30 days",
  "31-60": "31-60 days",
  "60+": "60+ days",
};

const BUCKET_ORDER: AgencyAgingBucket[] = ["0-7", "8-30", "31-60", "60+"];

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

export default async function AdminAgingReportPage() {
  await requirePlatformAdmin();
  const rows = await getAgencyAgingReport();

  const summary = BUCKET_ORDER.map((bucket) => {
    const matching = rows.filter((r) => r.bucket === bucket);
    return {
      bucket,
      count: matching.length,
      total: matching.reduce((sum, r) => sum + r.outstandingAmount, 0),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Aging Report</h1>
          <p className="text-sm text-muted-foreground">
            Agencies currently carrying a negative wallet balance, grouped by how long they&apos;ve
            been in the red.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" render={<Link href="/admin/reports/aging/export" />}>
          <Download className="size-3.5" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.bucket}>
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{BUCKET_LABELS[s.bucket]}</p>
                <p className="mt-1 truncate font-heading text-2xl font-bold">{money(s.total)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.count} {s.count === 1 ? "agency" : "agencies"}
                </p>
              </div>
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  BUCKET_STYLES[s.bucket]
                )}
              >
                <TrendingDown className="size-4.5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden py-0">
        {rows.length === 0 ? (
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No agencies currently carry a negative balance.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Aging Since</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Bucket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.agencyId}>
                    <TableCell>
                      <p className="font-medium">{row.agencyName}</p>
                      <p className="text-xs text-muted-foreground">{row.contactEmail}</p>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      {money(row.outstandingAmount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(row.agingSince).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">{row.agingDays}</TableCell>
                    <TableCell>
                      <Badge className={cn("border-transparent", BUCKET_STYLES[row.bucket])}>
                        {BUCKET_LABELS[row.bucket]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
