import { AgentMoney } from "@/components/portal/agent-money";
import { WaafiPaymentStatus } from "@/modules/payments/components/waafi-payment-status";
import type { Metadata } from "next";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Undo2, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyTopupRequests } from "@/modules/agencies/queries";
import { cancelTopupRequest } from "@/modules/agencies/topup-actions";
import { reconcileWaafiTopup } from "@/modules/payments/waafi-topup";
import { getTopupOptions } from "@/modules/payments/topup";
import { BackLink } from "@/components/back-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/money";
import { TopUpPanel } from "./top-up-panel";

export const metadata: Metadata = { title: "Add Money" };

/** A cancelled top-up was withdrawn by the agency itself, not refused. */
const STATUS_OVERRIDES = { cancelled: "neutral" } as const;

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  evc_plus: "EVC Plus",
  zaad: "ZAAD",
  sahal: "Sahal",
  edahab: "eDahab",
  cash_office: "Cash at office",
  card: "Card",
};

export default async function AgentTopUpPage({ searchParams }: { searchParams: Promise<{ status?: string; topupId?: string }> }) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { status: requestedStatus, topupId } = await searchParams;
  const canTopUp = membership.roleInAgency === "owner" || membership.roleInAgency === "admin";
  const options = await getTopupOptions();
  let requests = await getAgencyTopupRequests(membership.agency.id);
  // Recover paid hosted sessions even if the customer closed the return page.
  const unsettled = requests.filter((r) => r.provider === "waafi" && r.rail === "online" && r.status === "pending" && r.provider_ref).slice(0, 3);
  if (unsettled.length > 0) {
    const results = await Promise.all(unsettled.map((r) => reconcileWaafiTopup(r.id, membership.agency.id)));
    if (results.some((r) => r === "success" || r === "failed")) requests = await getAgencyTopupRequests(membership.agency.id);
  }

  const returnedRequest = requests.find((r) => r.id === topupId);
  const status = returnedRequest?.status === "approved" ? "success"
    : returnedRequest?.status === "failed" ? "failed"
    : requestedStatus === "success" ? "pending" : requestedStatus;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BackLink href="/agent/finance" label="Finance" />
        <PageHeader title="Add money" />
      </div>

      {status === "success" ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Wallet topped up.</AlertDescription>
        </Alert>
      ) : status === "cancelled" || status === "failed" ? (
        <Alert>
          <AlertCircle />
          <AlertDescription>Payment was not completed.</AlertDescription>
        </Alert>
      ) : status === "pending" ? (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>Payment confirmation pending.</AlertDescription>
        </Alert>
      ) : null}

      {!canTopUp ? (
        <Alert>
          <AlertCircle />
          <AlertDescription>Only the agency owner or an admin can add money.</AlertDescription>
        </Alert>
      ) : (
        <TopUpPanel
          balance={Number(membership.agency.credit_balance ?? 0)}
          available={Number(membership.agency.credit_balance ?? 0) + Number(membership.agency.credit_limit ?? 0)}
          online={options.online}
          offline={options.offline}
          bankTransfer={options.bankTransfer}
        />
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-base font-semibold">Top-up history</h2>
          {requests.length > 0 ? (
            <Badge variant="neutral" className="tabular-nums">
              {requests.length}
            </Badge>
          ) : null}
        </div>
        <Card className="overflow-hidden py-0">
          {requests.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Wallet />
              </EmptyMedia>
              <EmptyTitle>No top-ups</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead numeric>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {format(new Date(request.requested_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {METHOD_LABELS[request.method] ?? request.method}
                      {request.rail === "online" ? (
                        <Badge variant="outline" className="ml-2">
                          Online
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {request.reference ?? request.provider_ref ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                      {<AgentMoney value={money(Number(request.amount), "USD")} />}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(request.status, STATUS_OVERRIDES)} className="capitalize">
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-[220px] truncate text-muted-foreground"
                      title={request.review_note ?? request.note ?? ""}
                    >
                      {request.review_note ?? request.note ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" && request.provider === "waafi" ? (
                        <WaafiPaymentStatus kind="topup" referenceId={request.id} agencyId={membership.agency.id} autoPoll={request.id === topupId} />
                      ) : request.status === "pending" && canTopUp ? (
                        <form action={cancelTopupRequest}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <Button
                            type="submit"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Cancel top-up"
                            title="Cancel top-up"
                          >
                            <Undo2 aria-hidden="true" />
                          </Button>
                        </form>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>
    </div>
  );
}
