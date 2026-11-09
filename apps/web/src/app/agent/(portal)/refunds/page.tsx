import { AgentMoney } from "@/components/portal/agent-money";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyRefundRequests, getAgencyRefundableOrders } from "@/modules/agencies/queries";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/money";
import { parsePage } from "@/lib/pagination";
import { Pager } from "@/components/dashboard/pager";
import { RequestRefundForm } from "./request-refund-form";

export const metadata: Metadata = { title: "Refunds" };

export default async function AgentRefundsPage({ searchParams }: { searchParams: Promise<{ page?: string; order?: string }> }) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const canRequest = ["owner", "admin", "booking_staff"].includes(membership.roleInAgency);

  const params = await searchParams;
  const page = parsePage(params.page);
  const [{ rows: requests, total }, refundableOrders] = await Promise.all([
    getAgencyRefundRequests(membership.agency.id, page),
    canRequest ? getAgencyRefundableOrders(membership.agency.id) : Promise.resolve([]),
  ]);
  const hrefFor = (target: number) => (target > 1 ? `/agent/refunds?page=${target}` : "/agent/refunds");
  if (page > 1 && requests.length === 0) redirect(hrefFor(1));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
        meta={total > 0 ? <span className="tabular-nums">{total} {total === 1 ? "request" : "requests"}</span> : null}
        actions={canRequest ? <RequestRefundForm orders={refundableOrders} initialOrderId={params.order} /> : null}
      />

      <Card className="overflow-hidden py-0">
        {requests.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <RotateCcw />
            </EmptyMedia>
            <EmptyTitle>No refund requests</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="text-muted-foreground">{format(new Date(req.created_at), "d MMM yyyy")}</TableCell>
                  <TableCell className="font-mono text-xs">{req.order?.order_number ?? "—"}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground" title={req.reason}>
                    {req.reason}
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {<AgentMoney value={money(Number(req.amount), req.currency)} />}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(req.status)} className="capitalize">
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground" title={req.review_notes ?? ""}>
                    {req.review_notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Pager page={page} total={total} hrefFor={hrefFor} />
    </div>
  );
}
