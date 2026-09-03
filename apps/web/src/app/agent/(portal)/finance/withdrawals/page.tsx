import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { AlertCircle, FileText, Landmark, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getMyAgency,
  getAgencyEarningsSummary,
  getAgencyPayoutRequests,
  type AgencyPayoutRequest,
} from "@/modules/agencies/queries";
import { cancelAgencyPayoutRequest } from "@/modules/agencies/payout-actions";
import { payoutMethodLabel } from "@/modules/payments/payout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { WithdrawForm } from "./withdraw-form";

export const metadata: Metadata = { title: "Withdraw Earnings" };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  approved: "bg-primary/10 text-primary",
  processing: "bg-chart-4/15 text-chart-4",
  paid: "bg-chart-3/10 text-chart-3",
  rejected: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "In review",
  approved: "Approved",
  processing: "On the way",
  paid: "Paid",
  rejected: "Declined",
  failed: "Failed",
};

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

type TimelineStep = { label: string; at: string | null; detail?: string | null; state: "done" | "failed" | "idle" };

/**
 * Where the money has got to. A status word alone can't answer that once a
 * transfer is a real bank transfer with a date and a reference behind it —
 * "approved" and "sitting in my account" are days apart on the offline rail.
 */
function stepsFor(request: AgencyPayoutRequest): TimelineStep[] {
  const steps: TimelineStep[] = [{ label: "Requested", at: request.requested_at, state: "done" }];

  if (request.status === "rejected") {
    steps.push({ label: "Declined", at: request.reviewed_at, detail: request.review_note, state: "failed" });
    return steps;
  }

  steps.push({
    label: "Approved",
    at: request.reviewed_at,
    state: request.status === "pending" ? "idle" : "done",
  });

  const sentDetail = [payoutMethodLabel(request.method), request.reference].filter(Boolean).join(" · ");
  steps.push({
    label: "Transfer sent",
    at: request.sent_at,
    detail: sentDetail || null,
    state: request.sent_at ? "done" : "idle",
  });

  if (request.status === "failed") {
    steps.push({ label: "Failed", at: null, detail: request.failure_reason, state: "failed" });
    return steps;
  }

  steps.push({
    label: "Paid",
    at: request.paid_at,
    state: request.status === "paid" ? "done" : "idle",
  });
  return steps;
}

function RequestTimeline({ request, receiptUrl }: { request: AgencyPayoutRequest; receiptUrl?: string }) {
  return (
    <ol className="space-y-2.5 border-l border-border pl-4">
      {stepsFor(request).map((step) => (
        <li key={step.label} className="relative text-sm">
          <span
            className={cn(
              "absolute -left-[21px] top-1.5 size-2 rounded-full",
              step.state === "done" ? "bg-primary" : step.state === "failed" ? "bg-destructive" : "bg-border"
            )}
          />
          <p className={cn("font-medium", step.state === "idle" && "text-muted-foreground")}>
            {step.label}
            {step.at ? (
              <span className="ml-2 font-normal text-muted-foreground">
                {format(new Date(step.at), "d MMM yyyy")}
              </span>
            ) : null}
          </p>
          {step.detail ? (
            <p className={cn("text-xs", step.state === "failed" ? "text-destructive" : "text-muted-foreground")}>
              {step.detail}
            </p>
          ) : null}
        </li>
      ))}
      {receiptUrl ? (
        <li className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
          <a
            href={receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <FileText className="size-3.5" /> Receipt
          </a>
        </li>
      ) : null}
    </ol>
  );
}

export default async function AgentWithdrawalsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const canRequest = membership.roleInAgency === "owner" || membership.roleInAgency === "admin";
  const hasBankDetails = Boolean(membership.agency.bank_account_number?.trim());

  const [earnings, requests] = await Promise.all([
    getAgencyEarningsSummary(membership.agency.id),
    getAgencyPayoutRequests(membership.agency.id),
  ]);

  const supabase = await createClient();
  const receiptUrls = new Map<string, string>();
  for (const request of requests) {
    if (!request.proof_path) continue;
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(request.proof_path, 3600);
    if (data?.signedUrl) receiptUrls.set(request.id, data.signedUrl);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Withdraw Earnings</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Available to withdraw</p>
            <p className="mt-1 font-heading text-3xl font-bold text-primary">{money(earnings.available)}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 text-xs">
              <div>
                <dt className="text-muted-foreground">In review by STS</dt>
                <dd className="mt-0.5 font-medium">{money(earnings.inReview)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Already requested</dt>
                <dd className="mt-0.5 font-medium">{money(earnings.requested)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request a transfer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasBankDetails ? (
              <Alert>
                <AlertCircle />
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  <span>Add your payout account first.</span>
                  <Button size="sm" variant="outline" className="h-7 gap-1.5" render={<Link href="/agent/bank-details" />}>
                    <Landmark className="size-3.5" /> Bank Details
                  </Button>
                </AlertDescription>
              </Alert>
            ) : !canRequest ? (
              <Alert>
                <AlertCircle />
                <AlertDescription>Only the agency owner or an admin can request a payout.</AlertDescription>
              </Alert>
            ) : (
              <>
                <WithdrawForm available={earnings.available} />
                <dl className="grid gap-1 border-t border-border pt-4 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Bank</dt>
                    <dd className="mt-0.5 font-medium">{membership.agency.bank_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Account name</dt>
                    <dd className="mt-0.5 truncate font-medium">{membership.agency.bank_account_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Account number</dt>
                    <dd className="mt-0.5 truncate font-medium">{membership.agency.bank_account_number}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Branch</dt>
                    <dd className="mt-0.5 truncate font-medium">{membership.agency.bank_branch ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">SWIFT/BIC</dt>
                    <dd className="mt-0.5 truncate font-medium">{membership.agency.bank_swift_code ?? "—"}</dd>
                  </div>
                </dl>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Requests</CardTitle>
        </CardHeader>
        {requests.length === 0 ? (
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No requests yet.</CardContent>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((request) => (
              <div key={request.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:p-5">
                <div className="space-y-2">
                  <p className="font-heading text-lg font-semibold">{money(Number(request.amount))}</p>
                  <Badge className={cn("border-transparent", STATUS_STYLES[request.status] ?? "")}>
                    {STATUS_LABEL[request.status] ?? request.status}
                  </Badge>
                  {request.status === "pending" && canRequest ? (
                    <form action={cancelAgencyPayoutRequest}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <Button type="submit" size="sm" variant="ghost" className="gap-1.5 px-0">
                        <Undo2 className="size-3.5" /> Cancel
                      </Button>
                    </form>
                  ) : null}
                </div>
                <RequestTimeline request={request} receiptUrl={receiptUrls.get(request.id)} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
