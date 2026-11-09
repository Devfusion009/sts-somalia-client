import { AgentMoney } from "@/components/portal/agent-money";
import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { AlertCircle, Banknote, FileText, Pencil, Undo2 } from "lucide-react";
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
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { StatStrip, StatStripItem } from "@/components/dashboard/filter-chips";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import { WithdrawForm } from "./withdraw-form";

export const metadata: Metadata = { title: "Withdraw Earnings" };

const STATUS_VARIANT: Partial<Record<string, BadgeVariant>> = {
  approved: "info",
  processing: "info",
  rejected: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "In review",
  approved: "Approved",
  processing: "On the way",
  paid: "Paid",
  rejected: "Declined",
  failed: "Failed",
};

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
            aria-hidden="true"
            className={cn(
              "absolute top-1.5 -left-[21px] size-2 rounded-full ring-2 ring-card",
              step.state === "done" ? "bg-primary" : step.state === "failed" ? "bg-destructive" : "bg-border"
            )}
          />
          <p className={cn("font-medium", step.state === "idle" && "text-muted-foreground")}>
            {step.label}
            {step.at ? (
              <span className="ml-2 font-normal text-muted-foreground tabular-nums">
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
          <span aria-hidden="true" className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary ring-2 ring-card" />
          <a
            href={receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <FileText className="size-3.5" aria-hidden="true" /> Receipt
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

  const agency = membership.agency;

  return (
    <div className="space-y-6">
      <PageHeader title="Withdraw earnings" />

      <StatStrip cols={3}>
        <StatStripItem label="Available to withdraw" value={<AgentMoney value={money(earnings.available, "USD")} />} tone="primary" />
        <StatStripItem
          label="In review by STS"
          value={<AgentMoney value={money(earnings.inReview, "USD")} />}
          tone={earnings.inReview > 0 ? "warn" : undefined}
        />
        <StatStripItem label="Already requested" value={<AgentMoney value={money(earnings.requested, "USD")} />} />
      </StatStrip>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="lg:sticky lg:top-24 lg:order-2">
          <CardHeader>
            <CardTitle>Request a transfer</CardTitle>
            {hasBankDetails ? (
              <CardAction>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Edit bank details"
                  title="Edit bank details"
                  render={<Link href="/agent/bank-details" />}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasBankDetails ? (
              <Alert>
                <AlertCircle />
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  <span>Add your payout account first.</span>
                  <Button size="sm" variant="outline" render={<Link href="/agent/bank-details" />}>
                    Bank details
                  </Button>
                </AlertDescription>
              </Alert>
            ) : !canRequest ? (
              <Alert>
                <AlertCircle />
                <AlertDescription>Only the agency owner or an admin can request a payout.</AlertDescription>
              </Alert>
            ) : (
              <WithdrawForm available={earnings.available} />
            )}
            {hasBankDetails ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm">
                <div className="col-span-2 min-w-0">
                  <dt className="text-xs text-muted-foreground">Bank</dt>
                  <dd className="truncate font-medium">{agency.bank_name ?? "—"}</dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="text-xs text-muted-foreground">Account name</dt>
                  <dd className="truncate font-medium">{agency.bank_account_name ?? "—"}</dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="text-xs text-muted-foreground">Account number</dt>
                  <dd className="truncate font-mono font-medium">{agency.bank_account_number}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Branch</dt>
                  <dd className="truncate font-medium">{agency.bank_branch ?? "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">SWIFT/BIC</dt>
                  <dd className="truncate font-mono font-medium">{agency.bank_swift_code ?? "—"}</dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>

        <section className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold">Requests</h2>
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
                  <Banknote />
                </EmptyMedia>
                <EmptyTitle>No withdrawal requests</EmptyTitle>
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {requests.map((request) => (
                  <li key={request.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,12rem)_1fr] sm:p-5">
                    <div className="flex items-start justify-between gap-2 sm:flex-col sm:justify-start">
                      <div className="space-y-1.5">
                        <p className="font-heading text-lg font-semibold tabular-nums">
                          {<AgentMoney value={money(Number(request.amount), "USD")} />}
                        </p>
                        <Badge variant={statusBadgeVariant(request.status, STATUS_VARIANT)}>
                          {STATUS_LABEL[request.status] ?? request.status}
                        </Badge>
                      </div>
                      {request.status === "pending" && canRequest ? (
                        <form action={cancelAgencyPayoutRequest}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <Button type="submit" size="sm" variant="outline">
                            <Undo2 data-icon="inline-start" aria-hidden="true" /> Cancel request
                          </Button>
                        </form>
                      ) : null}
                    </div>
                    <RequestTimeline request={request} receiptUrl={receiptUrls.get(request.id)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
