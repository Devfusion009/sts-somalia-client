import type { Metadata } from "next";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { payoutMethodLabel } from "@/modules/payments/payout";
import {
  getPayoutQueue,
  getPayoutQueueTotals,
  type PayoutQueueFilter,
  type PayoutQueueRow,
} from "@/modules/agencies/queries";
import { PayoutRequestActions } from "../../agencies/[id]/earnings-review";
import { CopyValue } from "./copy-value";

export const metadata: Metadata = { title: "Withdrawals" };

const FILTERS: { key: PayoutQueueFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "pending", label: "To review" },
  { key: "approved", label: "To pay" },
  { key: "processing", label: "In transit" },
  { key: "paid", label: "Paid" },
  { key: "closed", label: "Declined & failed" },
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  approved: "bg-chart-3/10 text-chart-3",
  processing: "bg-chart-4/15 text-chart-4",
  paid: "bg-primary/10 text-primary",
  rejected: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "To review",
  approved: "Cleared to pay",
  processing: "In transit",
  paid: "Paid",
  rejected: "Declined",
  failed: "Failed",
};

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

function isFilter(value: string | undefined): value is PayoutQueueFilter {
  return FILTERS.some((f) => f.key === value);
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-heading text-lg font-semibold">{value}</dd>
      {sub ? <dd className="text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}

/** Where the money has to go — the details an admin retypes at the bank. */
function Destination({ request }: { request: PayoutQueueRow }) {
  const line = [request.bank_name, request.bank_branch].filter(Boolean).join(" · ");
  return (
    <div className="min-w-52 space-y-0.5 text-xs">
      <p className="text-sm font-medium">{line || "—"}</p>
      <p className="text-muted-foreground">{request.bank_account_name ?? "—"}</p>
      {request.bank_account_number ? (
        <p className="flex items-center gap-1.5 font-mono">
          {request.bank_account_number}
          <CopyValue value={request.bank_account_number} />
        </p>
      ) : null}
      {request.bank_swift_code ? <p className="font-mono text-muted-foreground">{request.bank_swift_code}</p> : null}
    </div>
  );
}

/** What has happened to this transfer so far, in the admin's own terms. */
function StatusCell({ request, proofUrl }: { request: PayoutQueueRow; proofUrl?: string }) {
  const method = payoutMethodLabel(request.method);
  return (
    <div className="min-w-44 space-y-1">
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
          STATUS_STYLES[request.status] ?? "bg-muted text-muted-foreground"
        )}
      >
        {STATUS_LABEL[request.status] ?? request.status}
      </span>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {request.sent_at ? <p>Sent {format(new Date(request.sent_at), "d MMM yyyy")}</p> : null}
        {request.paid_at ? <p>Paid {format(new Date(request.paid_at), "d MMM yyyy")}</p> : null}
        {method ? <p>{method}</p> : null}
        {request.reference ? <p className="font-mono">{request.reference}</p> : null}
        {request.failure_reason ? <p className="text-destructive">{request.failure_reason}</p> : null}
        {request.status === "rejected" && request.review_note ? <p>{request.review_note}</p> : null}
        {proofUrl ? (
          <a
            href={proofUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <FileText className="size-3.5" /> Receipt
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const filter: PayoutQueueFilter = isFilter(params.status) ? params.status : "open";

  const [totals, requests] = await Promise.all([getPayoutQueueTotals(), getPayoutQueue(filter)]);

  const supabase = await createClient();
  const proofUrls = new Map<string, string>();
  for (const request of requests) {
    if (!request.proof_path) continue;
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(request.proof_path, 3600);
    if (data?.signedUrl) proofUrls.set(request.id, data.signedUrl);
  }

  const chipCount: Partial<Record<PayoutQueueFilter, number>> = {
    open: totals.toReviewCount + totals.toPayCount + totals.inTransitCount,
    pending: totals.toReviewCount,
    approved: totals.toPayCount,
    processing: totals.inTransitCount,
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Withdrawals</h1>

      <dl className="grid gap-4 rounded-lg bg-secondary/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="To review"
          value={money(totals.toReviewAmount)}
          sub={`${totals.toReviewCount} request${totals.toReviewCount === 1 ? "" : "s"}`}
        />
        <Stat
          label="Cleared to pay"
          value={money(totals.toPayAmount)}
          sub={`${totals.toPayCount} request${totals.toPayCount === 1 ? "" : "s"}`}
        />
        <Stat
          label="In transit"
          value={money(totals.inTransitAmount)}
          sub={`${totals.inTransitCount} request${totals.inTransitCount === 1 ? "" : "s"}`}
        />
        <Stat label="Paid this month" value={money(totals.paidThisMonth)} />
      </dl>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const count = chipCount[f.key];
          return (
            <Link
              key={f.key}
              href={`/admin/finance/withdrawals?status=${f.key}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              )}
            >
              {f.label}
              {count ? (
                <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-primary/15" : "bg-muted text-muted-foreground")}>
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden py-0">
        {requests.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No requests in this view.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} className="align-top">
                    <TableCell>
                      <Link
                        href={`/admin/agencies/${request.agency_id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {request.agency?.name ?? "—"}
                      </Link>
                      <p className="text-xs text-muted-foreground">{request.requester?.full_name ?? "—"}</p>
                    </TableCell>
                    <TableCell className="text-right font-heading font-semibold">
                      {money(Number(request.amount))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(request.requested_at), "d MMM yyyy")}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Destination request={request} />
                    </TableCell>
                    <TableCell>
                      <StatusCell request={request} proofUrl={proofUrls.get(request.id)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <PayoutRequestActions
                        agencyId={request.agency_id}
                        requestId={request.id}
                        status={request.status}
                      />
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
