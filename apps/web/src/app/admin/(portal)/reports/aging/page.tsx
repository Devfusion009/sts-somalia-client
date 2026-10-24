import type { Metadata } from "next";
import { format } from "date-fns";
import { Download, Scale } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAgencyAgingReport, type AgencyAgingBucket } from "@/modules/agencies/queries";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatStrip, StatStripItem } from "@/components/dashboard/filter-chips";
import { money } from "@/lib/money";

export const metadata: Metadata = { title: "Aging Report" };

const BUCKET_VARIANT: Record<AgencyAgingBucket, BadgeVariant> = {
  "0-7": "neutral",
  "8-30": "info",
  "31-60": "warning",
  "60+": "destructive",
};

const BUCKET_LABELS: Record<AgencyAgingBucket, string> = {
  "0-7": "0-7 days",
  "8-30": "8-30 days",
  "31-60": "31-60 days",
  "60+": "60+ days",
};

const BUCKET_ORDER: AgencyAgingBucket[] = ["0-7", "8-30", "31-60", "60+"];

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
      <PageHeader
        title="Aging Report"
        actions={
          <Button variant="outline" nativeButton={false} render={<a href="/admin/reports/aging/export" />}>
            <Download aria-hidden="true" /> Export CSV
          </Button>
        }
      />

      <StatStrip>
        {summary.map((s) => (
          <StatStripItem
            key={s.bucket}
            label={BUCKET_LABELS[s.bucket]}
            value={money(s.total, "USD")}
            sub={`${s.count} ${s.count === 1 ? "agency" : "agencies"}`}
            tone={s.bucket === "60+" && s.count > 0 ? "warn" : undefined}
          />
        ))}
      </StatStrip>

      <Card className="overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Scale />
            </EmptyMedia>
            <EmptyTitle>No agencies with a negative balance</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead numeric>Outstanding</TableHead>
                <TableHead>Aging since</TableHead>
                <TableHead numeric>Days</TableHead>
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
                  <TableCell numeric className="font-semibold text-destructive">
                    {money(row.outstandingAmount, "USD")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(row.agingSince), "d MMM yyyy")}</TableCell>
                  <TableCell numeric>{row.agingDays}</TableCell>
                  <TableCell>
                    <Badge variant={BUCKET_VARIANT[row.bucket]}>{BUCKET_LABELS[row.bucket]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
