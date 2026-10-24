import type { Metadata } from "next";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Banknote, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips, StatStrip, StatStripItem } from "@/components/dashboard/filter-chips";
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
import { money } from "@/lib/money";

export const metadata: Metadata = { title: "Withdrawals" };

const FILTERS: { key: PayoutQueueFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "pending", label: "To review" },
  { key: "approved", label: "To pay" },
  { key: "processing", label: "In transit" },
  { key: "paid", label: "Paid" },
  { key: "closed", label: "Declined & failed" },
];

// "approved" here means cleared to pay — still waiting on staff, not done.
const STATUS_OVERRIDES = { approved: "info", processing: "info", rejected: "neutral" } as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "To review",
  approved: "Cleared to pay",
  processing: "In transit",
  paid: "Paid",
  rejected: "Declined",
  failed: "Failed",
};

function isFilter(value: string | undefined): value is PayoutQueueFilter {
  return FILTERS.some((f) => f.key === value);
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
      <Badge variant={statusBadgeVariant(request.status, STATUS_OVERRIDES)}>
        {STATUS_LABEL[request.status] ?? request.status}
      </Badge>
      <div className="max-w-56 space-y-0.5 text-xs whitespace-normal text-muted-foreground">
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
            className="inline-flex items-center gap-1 rounded-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <FileText className="size-3.5" aria-hidden="true" /> Receipt
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
      <PageHeader title="Withdrawals" />

      <StatStrip>
        <StatStripItem
          label="To review"
          value={money(totals.toReviewAmount, "USD")}
          sub={`${totals.toReviewCount} request${totals.toReviewCount === 1 ? "" : "s"}`}
          tone={totals.toReviewCount > 0 ? "warn" : undefined}
        />
        <StatStripItem
          label="Cleared to pay"
          value={money(totals.toPayAmount, "USD")}
          sub={`${totals.toPayCount} request${totals.toPayCount === 1 ? "" : "s"}`}
        />
        <StatStripItem
          label="In transit"
          value={money(totals.inTransitAmount, "USD")}
          sub={`${totals.inTransitCount} request${totals.inTransitCount === 1 ? "" : "s"}`}
        />
        <StatStripItem label="Paid this month" value={money(totals.paidThisMonth, "USD")} tone="primary" />
      </StatStrip>

      <FilterChips
        label="Filter withdrawals"
        active={filter}
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          href: `/admin/finance/withdrawals?status=${f.key}`,
          count: chipCount[f.key],
        }))}
      />

      <Card className="overflow-hidden py-0">
        {requests.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Banknote />
            </EmptyMedia>
            <EmptyTitle>No withdrawal requests in this view</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id} className="align-top">
                  <TableCell>
                    <Link
                      href={`/admin/agencies/${request.agency_id}`}
                      className="rounded-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {request.agency?.name ?? "—"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{request.requester?.full_name ?? "—"}</p>
                  </TableCell>
                  <TableCell numeric className="font-heading font-semibold">
                    {money(Number(request.amount), "USD")}
                  </TableCell>
                  <TableCell>
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
                  <TableCell numeric>
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
        )}
      </Card>
    </div>
  );
}
