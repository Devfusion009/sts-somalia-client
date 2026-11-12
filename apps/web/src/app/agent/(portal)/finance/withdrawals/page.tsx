import { AgentMoney } from "@/components/portal/agent-money";
import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { AlertCircle, Banknote, Check, FileText, Landmark, Undo2, WalletCards, X } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
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

/** Four fixed checkpoints, left to right, so every request reads the same way. */
function RequestProgress({ request }: { request: AgencyPayoutRequest }) {
  const steps = stepsFor(request);
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Progress">
      {steps.map((step, index) => (
        <li key={step.label} className="relative min-w-0" aria-current={step.state !== "idle" && steps[index + 1]?.state === "idle" ? "step" : undefined}>
          {index > 0 ? (
            <span
              aria-hidden="true"
              className={cn("absolute top-[9px] right-1/2 left-[-50%] h-0.5 rounded-full", step.state === "done" ? "bg-primary" : step.state === "failed" ? "bg-destructive/40" : "bg-border")}
            />
          ) : null}
          <span className="relative flex flex-col items-center gap-1.5 text-center">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5 items-center justify-center rounded-full ring-4 ring-card",
                step.state === "done" ? "bg-primary text-primary-foreground" : step.state === "failed" ? "bg-destructive text-white" : "border-2 border-border bg-card"
              )}
            >
              {step.state === "done" ? <Check className="size-3" strokeWidth={3} /> : step.state === "failed" ? <X className="size-3" strokeWidth={3} /> : null}
            </span>
            <span className={cn("text-xs font-semibold", step.state === "idle" && "font-medium text-muted-foreground", step.state === "failed" && "text-destructive")}>{step.label}</span>
            <span className="text-[0.6875rem] text-muted-foreground tabular-nums">{step.at ? format(new Date(step.at), "d MMM") : "\u00a0"}</span>
          </span>
        </li>
      ))}
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
  const facts = [
    { label: "In review by STS", value: earnings.inReview },
    { label: "Requested", value: earnings.requested },
    { label: "Paid out", value: earnings.paidOut },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Withdraw earnings" />

      <section aria-label="Earnings balance" className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,color-mix(in_oklch,var(--primary),black_35%),var(--primary))] p-5 text-primary-foreground shadow-[0_18px_40px_-24px_var(--primary)] sm:p-7">
        <WalletCards aria-hidden="true" className="pointer-events-none absolute -right-6 -bottom-8 size-44 opacity-10" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <dl>
            <dt className="text-sm font-medium opacity-80">Available to withdraw</dt>
            <dd className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              <AgentMoney value={money(earnings.available, "USD")} />
            </dd>
          </dl>
          <dl className="grid w-full grid-cols-3 gap-3 sm:w-auto sm:gap-8">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0 border-l border-primary-foreground/25 pl-3">
                <dt className="truncate text-xs opacity-75">{fact.label}</dt>
                <dd className="mt-0.5 truncate text-base font-semibold tabular-nums">
                  <AgentMoney value={money(fact.value, "USD")} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="lg:sticky lg:top-24 lg:order-2">
          <CardHeader>
            <CardTitle className="font-heading text-base">New withdrawal</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasBankDetails ? (
              <Empty className="rounded-xl border border-dashed border-border py-8">
                <EmptyMedia variant="icon"><Landmark /></EmptyMedia>
                <EmptyTitle>No payout account</EmptyTitle>
                <Button render={<Link href="/agent/bank-details" />}>Add bank details</Button>
              </Empty>
            ) : !canRequest ? (
              <Alert>
                <AlertCircle />
                <AlertDescription>Only the agency owner or an admin can request a payout.</AlertDescription>
              </Alert>
            ) : (
              <WithdrawForm
                available={earnings.available}
                bank={{ name: agency.bank_name, holder: agency.bank_account_name, accountNumber: agency.bank_account_number ?? "" }}
              />
            )}
          </CardContent>
        </Card>

        <section className="min-w-0 space-y-3" aria-labelledby="withdrawal-history">
          <div className="flex items-center gap-2">
            <h2 id="withdrawal-history" className="font-heading text-base font-semibold">Withdrawal history</h2>
            {requests.length > 0 ? (
              <Badge variant="neutral" className="tabular-nums">{requests.length}</Badge>
            ) : null}
          </div>
          {requests.length === 0 ? (
            <Card>
              <Empty>
                <EmptyMedia variant="icon"><Banknote /></EmptyMedia>
                <EmptyTitle>No withdrawals yet</EmptyTitle>
              </Empty>
            </Card>
          ) : (
            <ul className="space-y-3">
              {requests.map((request) => {
                const receiptUrl = receiptUrls.get(request.id);
                const detail = request.status === "rejected"
                  ? request.review_note
                  : request.status === "failed"
                    ? request.failure_reason
                    : [payoutMethodLabel(request.method), request.reference].filter(Boolean).join(" · ");
                return (
                  <li key={request.id} className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-heading text-xl font-semibold tabular-nums">
                          <AgentMoney value={money(Number(request.amount), "USD")} />
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                          {format(new Date(request.requested_at), "d MMM yyyy, HH:mm")}
                        </p>
                      </div>
                      <Badge variant={statusBadgeVariant(request.status, STATUS_VARIANT)}>
                        {STATUS_LABEL[request.status] ?? request.status}
                      </Badge>
                    </div>
                    <div className="mt-5">
                      <RequestProgress request={request} />
                    </div>
                    {detail || receiptUrl || (request.status === "pending" && canRequest) ? (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                        <p className={cn("min-w-0 text-xs", ["rejected", "failed"].includes(request.status) ? "text-destructive" : "text-muted-foreground")}>
                          {detail}
                        </p>
                        <div className="flex items-center gap-2">
                          {receiptUrl ? (
                            <Button size="sm" variant="outline" render={<a href={receiptUrl} target="_blank" rel="noreferrer" />}>
                              <FileText data-icon="inline-start" aria-hidden="true" />Receipt
                            </Button>
                          ) : null}
                          {request.status === "pending" && canRequest ? (
                            <form action={cancelAgencyPayoutRequest}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <Button type="submit" size="sm" variant="ghost">
                                <Undo2 data-icon="inline-start" aria-hidden="true" />Cancel
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
