import type { Metadata } from "next";
import { format } from "date-fns";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPendingRefundRequestsForAdmin, getRecentReviewedRefundRequestsForAdmin } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { RefundRequestActions } from "./refund-request-actions";
import { CustomerRequestActions } from "./customer-request-actions";

export const metadata: Metadata = { title: "Refund Requests" };

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
};

function money(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

export default async function AdminRefundsPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const [pending, reviewed, { data: customerRequests }] = await Promise.all([
    getPendingRefundRequestsForAdmin(),
    getRecentReviewedRefundRequestsForAdmin(),
    supabase
      .from("booking_requests")
      .select(
        `id, kind, status, reason, requested_amount, approved_amount, currency, created_at,
         order:orders(order_number),
         requester:profiles!booking_requests_requested_by_fkey(full_name, email)`
      )
      .in("status", ["requested", "in_review", "approved"])
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Refund Requests</h1>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">
            Customer requests
            {(customerRequests ?? []).length > 0 ? (
              <Badge className="ml-2 border-transparent bg-brand-gold/15 text-brand-gold">{(customerRequests ?? []).length}</Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        {(customerRequests ?? []).length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No open customer requests.</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(customerRequests ?? []).map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(req.created_at), "d MMM yyyy, HH:mm")}</TableCell>
                    <TableCell>
                      <p className="font-medium">{req.requester?.full_name ?? req.requester?.email ?? "—"}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{req.order?.order_number ?? "—"}</TableCell>
                    <TableCell className="capitalize">{req.kind}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground" title={req.reason}>
                      {req.reason}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {req.approved_amount !== null
                        ? money(Number(req.approved_amount), req.currency)
                        : req.requested_amount !== null
                          ? money(Number(req.requested_amount), req.currency)
                          : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className="border-transparent bg-brand-gold/15 capitalize text-brand-gold">{req.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <CustomerRequestActions
                        requestId={req.id}
                        status={req.status}
                        kind={req.kind}
                        currency={req.currency}
                        suggestedAmount={Number(req.approved_amount ?? req.requested_amount ?? 0)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">
            Pending
            {pending.length > 0 ? (
              <Badge className="ml-2 border-transparent bg-brand-gold/15 text-brand-gold">{pending.length}</Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        {pending.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No pending refund requests.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(req.created_at), "d MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{req.agency?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{req.requester?.full_name ?? req.requester?.email}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{req.order?.order_number ?? "—"}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground" title={req.reason}>
                      {req.reason}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{money(Number(req.amount), req.currency)}</TableCell>
                    <TableCell className="text-right">
                      <RefundRequestActions requestId={req.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Recently reviewed</CardTitle>
        </CardHeader>
        {reviewed.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Nothing reviewed yet.</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reviewed</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {req.reviewed_at ? format(new Date(req.reviewed_at), "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="font-medium">{req.agency?.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{req.order?.order_number ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{money(Number(req.amount), req.currency)}</TableCell>
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
