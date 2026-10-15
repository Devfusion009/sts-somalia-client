import type { Metadata } from "next";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyTopupRequests } from "@/modules/agencies/queries";
import { cancelTopupRequest } from "@/modules/agencies/topup-actions";
import { getTopupOptions } from "@/modules/payments/topup";
import { BackLink } from "@/components/back-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BankTransferDetails, OfflineTopupForm, OnlineTopupForm } from "./top-up-forms";

export const metadata: Metadata = { title: "Add Money" };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  evc_plus: "EVC Plus",
  zaad: "ZAAD",
  sahal: "Sahal",
  edahab: "eDahab",
  cash_office: "Cash at office",
  card: "Card",
};

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

export default async function AgentTopUpPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { status } = await searchParams;
  const canTopUp = membership.roleInAgency === "owner" || membership.roleInAgency === "admin";
  const options = await getTopupOptions();
  const requests = await getAgencyTopupRequests(membership.agency.id);

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/agent/finance" label="Finance" className="mb-3" />
        <h1 className="font-heading text-2xl font-bold">Add money</h1>
      </div>

      {status === "success" ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Payment received — your wallet is topped up.</AlertDescription>
        </Alert>
      ) : status === "cancelled" ? (
        <Alert>
          <AlertCircle />
          <AlertDescription>Payment cancelled. Nothing was charged.</AlertDescription>
        </Alert>
      ) : status === "pending" ? (
        <Alert>
          <AlertCircle />
          <AlertDescription>Approve the payment on your phone to finish this top-up.</AlertDescription>
        </Alert>
      ) : null}

      {!canTopUp ? (
        <Alert>
          <AlertCircle />
          <AlertDescription>Only the agency owner or an admin can add money.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">I sent money to STS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BankTransferDetails bankTransfer={options.bankTransfer} />
              <OfflineTopupForm methods={options.offline} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pay now</CardTitle>
            </CardHeader>
            <CardContent>
              {options.online.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No online payment method is connected yet.
                </p>
              ) : (
                <OnlineTopupForm methods={options.online} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Top-ups</CardTitle>
        </CardHeader>
        {requests.length === 0 ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No top-ups yet.</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(request.requested_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {METHOD_LABELS[request.method] ?? request.method}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {request.rail === "online" ? "online" : "offline"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {request.reference ?? request.provider_ref ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{money(Number(request.amount))}</TableCell>
                    <TableCell>
                      <Badge className={cn("border-transparent capitalize", STATUS_STYLES[request.status] ?? "")}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground" title={request.review_note ?? request.note ?? ""}>
                      {request.review_note ?? request.note ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" && canTopUp ? (
                        <form action={cancelTopupRequest}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <Button type="submit" size="sm" variant="ghost" className="gap-1.5">
                            <Undo2 className="size-3.5" /> Cancel
                          </Button>
                        </form>
                      ) : (
                        "—"
                      )}
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
