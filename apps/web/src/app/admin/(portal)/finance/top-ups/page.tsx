import type { Metadata } from "next";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getTopupQueue,
  getTopupQueueTotals,
  type TopupQueueFilter,
  type TopupQueueRow,
} from "@/modules/agencies/queries";
import { TopupReview } from "../../agencies/[id]/topup-review";

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

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-brand-gold/15 text-brand-gold",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
};

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

function money(amount: number) {
  return `USD ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isFilter(value: string | undefined): value is TopupQueueFilter {
  return FILTERS.some((f) => f.key === value);
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "warn" | "primary";
}) {
  return (
    <div className="p-4">
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-heading text-2xl font-bold tabular-nums",
          tone === "warn" && "text-brand-gold",
          tone === "primary" && "text-primary"
        )}
      >
        {value}
      </dd>
      {sub ? <dd className="mt-0.5 text-xs text-muted-foreground">{sub}</dd> : null}
    </div>
  );
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
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <FileText className="size-3.5" /> Receipt
        </a>
      ) : null}
    </div>
  );
}

function StatusCell({ request }: { request: TopupQueueRow }) {
  return (
    <div className="min-w-40 space-y-1">
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
          STATUS_STYLES[request.status] ?? "bg-muted text-muted-foreground"
        )}
      >
        {STATUS_LABEL[request.status] ?? request.status}
      </span>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        {request.rail === "online" ? <p>Online — settles automatically</p> : null}
        {request.review_note ? <p>{request.review_note}</p> : null}
      </div>
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
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Top-ups</h1>

      <dl className="grid divide-y divide-border rounded-lg border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat
          label="To review"
          value={money(totals.toReviewAmount)}
          sub={`${totals.toReviewCount} request${totals.toReviewCount === 1 ? "" : "s"}`}
          tone={totals.toReviewCount > 0 ? "warn" : "default"}
        />
        <Stat label="Credited this month" value={money(totals.creditedThisMonth)} tone="primary" />
        <Stat
          label="Declined & failed"
          value={`${totals.declinedCount} request${totals.declinedCount === 1 ? "" : "s"}`}
        />
      </dl>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const count = chipCount[f.key];
          return (
            <Link
              key={f.key}
              href={`/admin/finance/top-ups?status=${f.key}`}
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
                  <TableHead>Evidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {request.agency?.name ?? "—"}
                      </Link>
                      <p className="text-xs text-muted-foreground">{request.requester?.full_name ?? "—"}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="text-xs font-medium text-muted-foreground">USD</span>
                        <span
                          className={cn(
                            "font-heading text-xl font-bold tabular-nums",
                            Number(request.amount) >= LARGE_AMOUNT_THRESHOLD && "text-brand-gold"
                          )}
                        >
                          {Number(request.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      {Number(request.amount) >= LARGE_AMOUNT_THRESHOLD ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 py-0.5 text-[10px] font-semibold text-brand-gold">
                          <AlertTriangle className="size-3" /> Large amount
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
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
                    <TableCell className="text-right">
                      {request.status === "pending" && request.rail === "offline" ? (
                        <TopupReview agencyId={request.agency_id} requestId={request.id} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
