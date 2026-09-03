import { notFound } from "next/navigation";
import { format } from "date-fns";
import { BackLink } from "@/components/back-link";
import { requirePlatformAdmin } from "@/lib/auth/session";
import {
  getAgencyForAdmin,
  getAgencyWallet,
  getAgencyCommissionEntries,
  getAgencyCommissionPayouts,
  getAgencyMarkups,
  getAgencyMarkupRequests,
  getAgencyPeriodMetrics,
  getAgencyCustomerCounts,
  getAgencyEarningsSummary,
  getAgencyPayoutRequests,
  getAgencyTopupRequests,
} from "@/modules/agencies/queries";
import { createClient } from "@/lib/supabase/server";
import { MarkupRequestReview } from "../markup-request-review";
import { CommissionEntryReview, PayoutRequestActions } from "./earnings-review";
import { TopupReview } from "./topup-review";
import { scopeLabel, markupLabel, requestedLabel } from "@/modules/agencies/markup-labels";
import { MarkupChange, ScopeBadge } from "@/modules/agencies/components/markup-change";
import { agencyLogoUrl } from "@/modules/agencies/logo";
import { resolveDateRange, bucketLabel } from "@/lib/date-range";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { SalesTimelineChart } from "@/modules/agencies/components/sales-timeline-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  CommissionRateForm,
  CreditLimitForm,
  WalletTransactionForm,
  CommissionPayoutForm,
  AllowedProductsForm,
  IssueNoteForm,
} from "./agency-admin-forms";
import { AssignTierForm, LowBalanceThresholdForm } from "./tier-forms";
import { getAgencyTiers } from "@/modules/agencies/queries";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  pending: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

export default async function AdminAgencyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const range = resolveDateRange(await searchParams);

  const agency = await getAgencyForAdmin(id);
  if (!agency) notFound();

  const [wallet, commissionEntries, payouts, markups, markupRequests, tiers, metrics, customers, earnings, payoutRequests, topupRequests] =
    await Promise.all([
      getAgencyWallet(agency.id),
      getAgencyCommissionEntries(agency.id),
      getAgencyCommissionPayouts(agency.id),
      getAgencyMarkups(agency.id),
      getAgencyMarkupRequests(agency.id),
      getAgencyTiers(),
      getAgencyPeriodMetrics(agency.id, range),
      getAgencyCustomerCounts(agency.id),
      getAgencyEarningsSummary(agency.id),
      getAgencyPayoutRequests(agency.id),
      getAgencyTopupRequests(agency.id),
    ]);
  const supabaseForProofs = await createClient();
  const proofUrls = new Map<string, string>();
  for (const request of topupRequests) {
    if (!request.proof_path) continue;
    const { data } = await supabaseForProofs.storage.from("payment-proofs").createSignedUrl(request.proof_path, 3600);
    if (data?.signedUrl) proofUrls.set(request.id, data.signedUrl);
  }

  const pendingEntries = commissionEntries
    .filter((e) => e.status === "pending")
    .map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      orderNumber: e.order?.order_number ?? null,
      createdAt: e.created_at,
    }));
  const pendingMarkupRequests = markupRequests.filter((r) => r.status === "pending");
  const decidedMarkupRequests = markupRequests.filter((r) => r.status !== "pending").slice(0, 5);
  const currentMarkupByScope = new Map(markups.map((rule) => [rule.item_type ?? "all", rule]));
  const logoUrl = agencyLogoUrl(agency.logo_path);

  const totalEarned = commissionEntries
    .filter((e) => e.status !== "reversed")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackLink href="/admin/agencies" label="All agencies" className="mb-3" />
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={`${agency.name} logo`} className="size-full object-contain" />
              </span>
            ) : null}
            <h1 className="font-heading text-2xl font-semibold">{agency.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {[agency.contact_email, agency.contact_phone, agency.website, agency.address]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {agency.about ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{agency.about}</p>
          ) : null}
        </div>
        <Badge
          className={cn(
            "border-transparent capitalize",
            STATUS_STYLES[agency.status] ?? "bg-muted text-muted-foreground"
          )}
        >
          {agency.status}
        </Badge>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          {
            label: "Wallet Balance",
            value: `${wallet.balance < 0 ? "−" : ""}${money(Math.abs(wallet.balance))}`,
            destructive: wallet.balance < 0,
          },
          { label: "Credit Limit", value: money(wallet.creditLimit) },
          { label: "Available to Spend", value: money(wallet.available) },
          { label: "Total Earned", value: money(totalEarned) },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p
                className={cn(
                  "mt-1 font-heading text-xl font-bold",
                  stat.destructive ? "text-destructive" : undefined
                )}
              >
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">Performance</h2>
        <DateRangePicker currentKey={range.key} />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Tickets Cut", value: String(metrics.bookings.current), sub: undefined },
          {
            label: "Sales",
            value: `${metrics.revenue.currency} ${metrics.revenue.current.toFixed(0)}`,
            sub: undefined,
          },
          {
            label: "Agency Earned",
            value: `${metrics.revenue.currency} ${metrics.earned.current.toFixed(0)}`,
            sub: undefined,
          },
          {
            label: "Customers",
            value: `${customers.total}`,
            sub: `${customers.registered} with an STS account`,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 font-heading text-xl font-bold">{stat.value}</p>
              {stat.sub ? <p className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <SalesTimelineChart
        currency={metrics.revenue.currency}
        data={metrics.buckets.map((key, i) => ({
          label: bucketLabel(key, range.granularity),
          sales: metrics.revenue.series[i] ?? 0,
          tickets: metrics.bookings.series[i] ?? 0,
        }))}
      />

      {/* Controls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commission Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <CommissionRateForm agencyId={agency.id} currentRate={Number(agency.commission_rate)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credit Limit</CardTitle>
          </CardHeader>
          <CardContent>
            <CreditLimitForm agencyId={agency.id} currentLimit={Number(agency.credit_limit)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wallet Top-up / Adjustment</CardTitle>
          </CardHeader>
          <CardContent>
            <WalletTransactionForm agencyId={agency.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record Commission Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <CommissionPayoutForm agencyId={agency.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue Credit / Debit Note</CardTitle>
          </CardHeader>
          <CardContent>
            <IssueNoteForm agencyId={agency.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignTierForm
              agencyId={agency.id}
              currentTierId={agency.tier_id}
              tiers={tiers.map((t) => ({
                id: t.id,
                name: t.name,
                default_commission_rate: Number(t.default_commission_rate),
                default_credit_limit: Number(t.default_credit_limit),
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low-Balance Alert</CardTitle>
          </CardHeader>
          <CardContent>
            <LowBalanceThresholdForm
              agencyId={agency.id}
              currentThreshold={Number(agency.low_balance_threshold)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allowed Products</CardTitle>
          </CardHeader>
          <CardContent>
            <AllowedProductsForm agencyId={agency.id} current={agency.allowed_products} />
          </CardContent>
        </Card>
      </div>

      {/* Members + markups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b border-border !py-4">
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          {agency.agency_members.length === 0 ? (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No members.
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agency.agency_members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <p className="font-medium">{member.profiles?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{member.profiles?.email}</p>
                    </TableCell>
                    <TableCell className="capitalize">{member.role_in_agency}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {member.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card id="markups" className="scroll-mt-6 overflow-hidden py-0">
          <CardHeader className="border-b border-border !py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              Markup Rules
              {pendingMarkupRequests.length > 0 ? (
                <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">
                  {pendingMarkupRequests.length} pending
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          {pendingMarkupRequests.length > 0 ? (
            <ul className="divide-y divide-border border-b border-border">
              {pendingMarkupRequests.map((request) => {
                const current = currentMarkupByScope.get(request.item_type ?? "all");
                const requester = request.requester as { full_name: string | null; email: string } | null;
                return (
                  <li key={request.id} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-2">
                        <ScopeBadge itemType={request.item_type} />
                        <MarkupChange
                          current={current}
                          fallback={request.item_type === null ? null : currentMarkupByScope.get("all")}
                          request={request}
                        />
                        <p className="text-xs text-muted-foreground">
                          {requester?.full_name ?? requester?.email ?? "—"} ·{" "}
                          {format(new Date(request.requested_at), "dd MMM yyyy, hh:mm a")}
                        </p>
                      </div>
                      <div className="min-w-56">
                        <MarkupRequestReview requestId={request.id} agencyId={agency.id} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {markups.length === 0 ? (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">No markup rules.</CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applies to</TableHead>
                  <TableHead className="text-right">Markup</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {markups.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{scopeLabel(rule.item_type)}</TableCell>
                    <TableCell className="text-right font-semibold">{markupLabel(rule.markup_type, rule.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {decidedMarkupRequests.length > 0 ? (
            <ul className="divide-y divide-border border-t border-border">
              {decidedMarkupRequests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-medium">{scopeLabel(request.item_type)}</span>
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    {requestedLabel(request)}
                    {request.review_note ? <p className="text-xs text-muted-foreground">{request.review_note}</p> : null}
                  </div>
                  <div className="text-right">
                    <Badge
                      className={cn(
                        "border-transparent capitalize",
                        request.status === "approved" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {request.status}
                    </Badge>
                    {request.reviewed_at ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(new Date(request.reviewed_at), "dd MMM yyyy")}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      {/* Ledgers */}
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Wallet Transactions</CardTitle>
        </CardHeader>
        {wallet.transactions.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No wallet activity yet.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallet.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(tx.created_at), "d MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell className="capitalize">{tx.type.replace(/_/g, " ")}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {tx.order?.order_number ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {tx.note ?? "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        Number(tx.amount) < 0 ? "text-destructive" : "text-primary"
                      )}
                    >
                      {Number(tx.amount) < 0 ? "−" : "+"} {money(Math.abs(Number(tx.amount)))}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {money(Number(tx.balance_after))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings to review</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingEntries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing awaiting review.</p>
            ) : (
              <CommissionEntryReview agencyId={agency.id} entries={pendingEntries} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings balance</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Total earned</dt>
                <dd className="mt-0.5 font-semibold">{money(earnings.totalEarned)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">In review</dt>
                <dd className="mt-0.5 font-semibold text-brand-gold">{money(earnings.inReview)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Available to withdraw</dt>
                <dd className="mt-0.5 font-semibold text-primary">{money(earnings.available)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Requested</dt>
                <dd className="mt-0.5 font-semibold">{money(earnings.requested)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Paid out</dt>
                <dd className="mt-0.5 font-semibold">{money(earnings.paidOut)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Wallet Top-ups</CardTitle>
        </CardHeader>
        {topupRequests.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No top-ups yet.</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filed</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topupRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(request.requested_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {request.method.replace(/_/g, " ")}
                      <span className="ml-1.5 text-xs text-muted-foreground">{request.rail}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {request.reference ?? request.provider_ref ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{money(Number(request.amount))}</TableCell>
                    <TableCell>
                      {proofUrls.has(request.id) ? (
                        <a
                          href={proofUrls.get(request.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" && request.rail === "offline" ? (
                        <TopupReview agencyId={agency.id} requestId={request.id} />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Payout Requests</CardTitle>
        </CardHeader>
        {payoutRequests.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No payout requests yet.</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(request.requested_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{money(Number(request.amount))}</TableCell>
                    <TableCell className="text-sm">
                      <p>
                        {request.bank_name ?? "—"}
                        {request.bank_branch ? ` · ${request.bank_branch}` : ""}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {request.bank_account_number ?? "—"}
                        {request.bank_swift_code ? ` · ${request.bank_swift_code}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <PayoutRequestActions agencyId={agency.id} requestId={request.id} status={request.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Commission Entries</CardTitle>
        </CardHeader>
        {commissionEntries.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No settled agency bookings yet.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Markup</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <p className="font-mono text-xs font-medium">
                        {entry.order?.order_number ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "d MMM yyyy")}
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-sm">{entry.rate_applied}%</TableCell>
                    <TableCell className="text-right text-sm">
                      {money(Number(entry.commission_amount))}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {money(Number(entry.markup_amount))}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {money(Number(entry.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {entry.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b border-border !py-4">
          <CardTitle className="text-base">Commission Payouts</CardTitle>
        </CardHeader>
        {payouts.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No payouts recorded yet.
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paid</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(payout.paid_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">{payout.method ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{payout.payout_reference ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payout.period_start && payout.period_end
                        ? `${format(new Date(payout.period_start), "d MMM")} – ${format(new Date(payout.period_end), "d MMM yyyy")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{money(Number(payout.amount))}</TableCell>
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
