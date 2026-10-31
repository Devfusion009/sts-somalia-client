import { OperationsMetrics } from "../../operations-ui";
import styles from "../../operations.module.css";
import type { Metadata } from "next";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, FileText, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getTopupQueue,
  getTopupQueueTotals,
  type TopupQueueFilter,
  type TopupQueueRow,
} from "@/modules/agencies/queries";
import { TopupReview } from "../../agencies/[id]/topup-review";
import { money } from "@/lib/money";

export const metadata: Metadata = { title: "Top-ups" };

const FILTERS: { key: TopupQueueFilter; label: string }[] = [
  { key: "pending", label: "To review" },
  { key: "approved", label: "Credited" },
  { key: "declined", label: "Declined & failed" },
  { key: "all", label: "All" },
];

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  evc_plus: "EVC Plus",
  zaad: "ZAAD",
  sahal: "Sahal",
  edahab: "eDahab",
  cash_office: "Cash at office",
  card: "Card",
};

const STATUS_OVERRIDES = { cancelled: "neutral" } as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "To review",
  approved: "Credited",
  rejected: "Declined",
  cancelled: "Cancelled",
  failed: "Failed",
};

// Round-number threshold, not a compliance rule — it draws the reviewer's
// eye to a request that's a clear outlier against the typical few-hundred to
// low-thousand-dollar top-up before they click a wallet-crediting action.
const LARGE_AMOUNT_THRESHOLD = 5000;

function isFilter(value: string | undefined): value is TopupQueueFilter {
  return FILTERS.some((f) => f.key === value);
}

/** What the agent says they sent and how — the evidence an admin checks against a bank/EVC statement. */
function EvidenceCell({ request, proofUrl }: { request: TopupQueueRow; proofUrl?: string }) {
  return (
    <div className="min-w-40 space-y-0.5 text-xs">
      <p className="text-sm font-medium">{METHOD_LABELS[request.method] ?? request.method}</p>
      {request.reference ? <p className="font-mono text-muted-foreground">{request.reference}</p> : null}
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
  );
}

function StatusCell({ request }: { request: TopupQueueRow }) {
  return (
    <div className="min-w-40 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={statusBadgeVariant(request.status, STATUS_OVERRIDES)}>
          {STATUS_LABEL[request.status] ?? request.status}
        </Badge>
        {request.rail === "online" ? <Badge variant="outline">Online</Badge> : null}
      </div>
      {request.review_note ? (
        <p className="max-w-56 text-xs whitespace-normal text-muted-foreground">{request.review_note}</p>
      ) : null}
    </div>
  );
}

export default async function AdminTopupsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const filter: TopupQueueFilter = isFilter(params.status) ? params.status : "pending";

  const [totals, requests] = await Promise.all([getTopupQueueTotals(), getTopupQueue(filter)]);

  const supabase = await createClient();
  const proofUrls = new Map<string, string>();
  for (const request of requests) {
    if (!request.proof_path) continue;
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(request.proof_path, 3600);
    if (data?.signedUrl) proofUrls.set(request.id, data.signedUrl);
  }

  const chipCount: Partial<Record<TopupQueueFilter, number>> = {
    pending: totals.toReviewCount,
    declined: totals.declinedCount,
  };

  return (
    <div className={`${styles.page} space-y-6`}>
      <PageHeader title="Top-ups" />

      <OperationsMetrics items={[
        { label: "To review", value: money(totals.toReviewAmount, "USD"), detail: `${totals.toReviewCount} requests`, tone: "warning" },
        { label: "Credited this month", value: money(totals.creditedThisMonth, "USD"), tone: "primary" },
        { label: "Declined & failed", value: totals.declinedCount, detail: "Requests", tone: "danger" },
      ]} />
      <div className={styles.filters}>
      <FilterChips
        label="Filter top-ups"
        active={filter}
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          href: `/admin/finance/top-ups?status=${f.key}`,
          count: chipCount[f.key],
        }))}
      />

      </div>
      <Card className={`${styles.table} overflow-hidden py-0`}>
        {requests.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Wallet />
            </EmptyMedia>
            <EmptyTitle>No top-up requests in this view</EmptyTitle>
          </Empty>
        ) : (
          <Table containerClassName="max-h-[65vh]">
            <TableHeader sticky>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow
                  key={request.id}
                  className={cn(
                    "align-top",
                    Number(request.amount) >= LARGE_AMOUNT_THRESHOLD && "bg-brand-gold/5"
                  )}
                >
                  <TableCell>
                    <Link
                      href={`/admin/agencies/${request.agency_id}`}
                      className="rounded-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {request.agency?.name ?? "—"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{request.requester?.full_name ?? "—"}</p>
                  </TableCell>
                  <TableCell numeric>
                    <div className="flex items-baseline justify-end gap-1">
                      <span className="text-xs font-medium text-muted-foreground">USD</span>
                      <span className="font-heading text-base font-semibold tabular-nums">
                        {Number(request.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {Number(request.amount) >= LARGE_AMOUNT_THRESHOLD ? (
                      <Badge variant="warning" className="mt-1">
                        <AlertTriangle aria-hidden="true" /> Large amount
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {format(new Date(request.requested_at), "d MMM yyyy")}
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                    </p>
                  </TableCell>
                  <TableCell>
                    <EvidenceCell request={request} proofUrl={proofUrls.get(request.id)} />
                  </TableCell>
                  <TableCell>
                    <StatusCell request={request} />
                  </TableCell>
                  <TableCell numeric>
                    {request.status === "pending" && request.rail === "offline" ? (
                      <TopupReview agencyId={request.agency_id} requestId={request.id} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
