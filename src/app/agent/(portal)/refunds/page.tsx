import type { Metadata } from "next";
import { format } from "date-fns";
import { RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyRefundRequests, getAgencyRefundableOrders } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { RequestRefundForm } from "./request-refund-form";

export const metadata: Metadata = { title: "Refunds" };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
};

export default async function AgentRefundsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const canRequest = ["owner", "admin", "booking_staff"].includes(membership.roleInAgency);

  const [requests, refundableOrders] = await Promise.all([
    getAgencyRefundRequests(membership.agency.id),
    canRequest ? getAgencyRefundableOrders(membership.agency.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Refunds</h1>
        </div>
        {canRequest ? <RequestRefundForm orders={refundableOrders} /> : null}
      </div>

      <Card className="overflow-hidden py-0">
        {requests.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <RotateCcw className="size-8 text-muted-foreground" />
            <p className="font-medium">No refund requests yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {canRequest
                ? "Requesting a refund notifies STS admins for review — approved requests credit your wallet directly."
                : "Only the owner, an admin, or booking staff can request a refund."}
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(req.created_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{req.order?.order_number ?? "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground" title={req.reason}>
                      {req.reason}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {req.currency} {Number(req.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-transparent capitalize", STATUS_STYLES[req.status])}>{req.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground" title={req.review_notes ?? ""}>
                      {req.review_notes ?? "—"}
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
