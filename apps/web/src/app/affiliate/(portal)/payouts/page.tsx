import { Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpc } from "@/lib/trpc/server";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money, shortDate } from "@/lib/money";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Payouts" };

export default async function AffiliatePayoutsPage() {
  await requireUser();
  const trpc = await getServerTrpc();
  const affiliate = await trpc.affiliates.me.query();

  if (!affiliate) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No affiliate account.</AlertDescription>
      </Alert>
    );
  }

  const payouts = await trpc.affiliates.myPayouts.query();

  const paid = payouts.filter((p) => p.status === "paid");
  const open = payouts.filter((p) => p.status === "pending" || p.status === "processing");
  // Payout currency is per record; the rail sums in the first record's
  // currency (USD when there are none), matching how payouts are recorded.
  const currency = payouts[0]?.currency ?? "USD";
  const lastPaid = paid.find((p) => p.paid_at)?.paid_at ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Payouts" />

      <StatRail className="sm:grid-cols-3">
        <StatRailItem label="Paid out" value={money(paid.reduce((s, p) => s + Number(p.amount), 0), currency)} />
        <StatRailItem
          label="In progress"
          value={money(open.reduce((s, p) => s + Number(p.amount), 0), currency)}
          tone={open.length > 0 ? "warn" : undefined}
        />
        <StatRailItem label="Last payout" value={lastPaid ? shortDate(lastPaid) : "—"} />
      </StatRail>

      <Card className="py-0">
        {payouts.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Wallet />
            </EmptyMedia>
            <EmptyTitle>No payouts</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Paid on</TableHead>
                <TableHead numeric>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">
                    {p.period_start && p.period_end
                      ? `${shortDate(p.period_start)} – ${shortDate(p.period_end)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(p.status)} className="capitalize">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell numeric className="text-muted-foreground">
                    {p.paid_at ? shortDate(p.paid_at) : "—"}
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {money(p.amount, p.currency)}
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
