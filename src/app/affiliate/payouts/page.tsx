import { requireUser } from "@/lib/auth/session";
import { getMyAffiliate, getMyPayouts } from "@/modules/affiliates/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  processing: "secondary",
  pending: "secondary",
  failed: "destructive",
};

export default async function AffiliatePayoutsPage() {
  const profile = await requireUser();
  const affiliate = await getMyAffiliate(profile.id);

  if (!affiliate) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No affiliate account found for your profile. Please contact support.</AlertDescription>
      </Alert>
    );
  }

  const payouts = await getMyPayouts(affiliate.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Payouts</h1>
      </div>

      {payouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-medium">No payouts yet</p>
            <p className="text-sm text-muted-foreground">
              Commissions are paid out periodically once approved.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Paid on</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.period_start && p.period_end
                      ? `${new Date(p.period_start).toLocaleDateString()} – ${new Date(p.period_end).toLocaleDateString()}`
                      : "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.currency} {p.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"} className="capitalize">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
