import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, CheckCheck, Percent, Receipt, Users, Wallet } from "lucide-react";
import { format } from "date-fns";
import { BackLink } from "@/components/back-link";
import { requirePlatformAdmin } from "@/lib/auth/session";
import {
  getAgencyForAdmin,
  getAgencyWallet,
  getAgencyCommissionEntries,
  getAgencyPendingCommissionEntries,
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
import { SalesTimelineChart } from "@/components/dashboard/lazy-charts";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { StatStrip, StatStripItem } from "@/components/dashboard/filter-chips";
import { money } from "@/lib/money";
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
import { ADMIN_PAGE_SIZE, parsePage } from "@/lib/pagination";
import { Pager } from "@/components/dashboard/pager";
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

export const metadata: Metadata = { title: "Agency" };

const usd = (amount: number) => money(amount, "USD");

/** Whole-unit amounts for the performance strip. */
const whole = (amount: number, currency: string) =>
  `${currency} ${Math.round(amount).toLocaleString("en-US")}`;

const ENTRY_STATUS = { confirmed: "info", paid_out: "success", reversed: "neutral" } as const;

export default async function AdminAgencyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string; entries?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const range = resolveDateRange(sp);
  const entriesPage = parsePage(sp.entries);

  const agency = await getAgencyForAdmin(id);
  if (!agency) notFound();

  const [wallet, { rows: commissionEntries, total: commissionEntryTotal }, pending, payouts, markups, markupRequests, tiers, metrics, customers, earnings, payoutRequests, topupRequests] =
    await Promise.all([
      getAgencyWallet(agency.id),
      getAgencyCommissionEntries(agency.id, undefined, entriesPage),
      getAgencyPendingCommissionEntries(agency.id),
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
  const { data: partnerAccount } = await (await createClient())
    .from("partner_accounts")
    .select("id")
    .eq("type", "agency")
    .eq("entity_id", agency.id)
    .maybeSingle();
  // One signing request for every proof instead of one round trip per request.
  const proofUrls = new Map<string, string>();
  const withProof = topupRequests.filter((r) => r.proof_path);
  if (withProof.length > 0) {
    const supabaseForProofs = await createClient();
    const { data: signed } = await supabaseForProofs.storage
      .from("payment-proofs")
      .createSignedUrls(withProof.map((r) => r.proof_path as string), 3600);
    withProof.forEach((request, i) => {
      const url = signed?.[i]?.signedUrl;
      if (url) proofUrls.set(request.id, url);
    });
  }

  const mogadishuToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Mogadishu" }).format(new Date());
  const pendingEntries = pending.rows.map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      orderNumber: e.order?.order_number ?? null,
      createdAt: e.created_at,
      serviceEndsOn: e.serviceEndsOn,
      approvable: e.serviceEndsOn !== null && e.serviceEndsOn < mogadishuToday,
    }));
  const pendingMarkupRequests = markupRequests.filter((r) => r.status === "pending");
  const decidedMarkupRequests = markupRequests.filter((r) => r.status !== "pending").slice(0, 5);
  const currentMarkupByScope = new Map(markups.map((rule) => [rule.item_type ?? "all", rule]));
  const logoUrl = agencyLogoUrl(agency.logo_path);
  const meta = [agency.contact_email, agency.contact_phone, agency.website, agency.address].filter(Boolean).join(" · ");

  const totalEarned = earnings.totalEarned;
  const entriesHref = (target: number) => {
    const params = new URLSearchParams();
    for (const key of ["range", "from", "to"] as const) {
      const value = sp[key];
      if (value) params.set(key, value);
    }
    if (target > 1) params.set("entries", String(target));
    const qs = params.toString();
    return qs ? `/admin/agencies/${agency.id}?${qs}` : `/admin/agencies/${agency.id}`;
  };
  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <BackLink href="/admin/agencies" label="All agencies" />
        <header className="flex min-w-0 flex-wrap items-center gap-4">
          {logoUrl ? (
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background max-sm:size-12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={`${agency.name} logo`} className="size-full object-contain" />
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{agency.name}</h1>
              <Badge variant="outline" className="font-mono" title="Agent code">
                {agency.agent_code}
              </Badge>
              <Badge variant={statusBadgeVariant(agency.status)} className="capitalize">
                {agency.status}
              </Badge>
              {agency.agency_tiers?.name ? <Badge variant="info">{agency.agency_tiers.name}</Badge> : null}
            </div>
            {meta ? <p className="text-sm break-words text-muted-foreground">{meta}</p> : null}
          </div>
          {partnerAccount ? (
            <Button
              variant="outline"
              className="ml-auto shrink-0"
              render={<Link href={`/admin/partners/agency/${partnerAccount.id}`} />}
            >
              Account &amp; onboarding
            </Button>
          ) : null}
        </header>
        {agency.about ? <p className="max-w-3xl text-sm text-muted-foreground">{agency.about}</p> : null}

        <StatRail className="sm:grid-cols-3 lg:grid-cols-6">
          <StatRailItem
            label="Wallet balance"
            value={`${wallet.balance < 0 ? "−" : ""}${usd(Math.abs(wallet.balance))}`}
            tone={wallet.balance < 0 ? "destructive" : undefined}
          />
          <StatRailItem label="Credit limit" value={usd(wallet.creditLimit)} />
          <StatRailItem label="Available" value={usd(wallet.available)} tone="primary" />
          <StatRailItem label="Commission" value={`${agency.commission_rate}%`} />
          <StatRailItem label="Total earned" value={usd(totalEarned)} />
          <StatRailItem label="Members" value={agency.agency_members.length} />
        </StatRail>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold">Performance</h2>
          <DateRangePicker currentKey={range.key} />
        </div>
        <StatStrip>
          <StatStripItem label="Tickets cut" value={metrics.bookings.current.toLocaleString("en-US")} />
          <StatStripItem label="Sales" value={whole(metrics.revenue.current, metrics.revenue.currency)} />
          <StatStripItem label="Agency earned" value={whole(metrics.earned.current, metrics.revenue.currency)} />
          <StatStripItem
            label="Customers"
            value={customers.total.toLocaleString("en-US")}
            sub={`${customers.registered} with an STS account`}
          />
        </StatStrip>
        <SalesTimelineChart
          currency={metrics.revenue.currency}
          data={metrics.buckets.map((key, i) => ({
            label: bucketLabel(key, range.granularity),
            sales: metrics.revenue.series[i] ?? 0,
            tickets: metrics.bookings.series[i] ?? 0,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Account controls</h2>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ControlCard title="Commission rate">
            <CommissionRateForm agencyId={agency.id} currentRate={Number(agency.commission_rate)} />
          </ControlCard>
          <ControlCard title="Credit limit">
            <CreditLimitForm agencyId={agency.id} currentLimit={Number(agency.credit_limit)} />
          </ControlCard>
          <ControlCard title="Low-balance alert">
            <LowBalanceThresholdForm agencyId={agency.id} currentThreshold={Number(agency.low_balance_threshold)} />
          </ControlCard>
          <ControlCard title="Wallet adjustment">
            <WalletTransactionForm agencyId={agency.id} />
          </ControlCard>
          <ControlCard title="Credit / debit note">
            <IssueNoteForm agencyId={agency.id} />
          </ControlCard>
          <ControlCard title="Commission payout">
            <CommissionPayoutForm agencyId={agency.id} />
          </ControlCard>
          <ControlCard title="Tier">
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
          </ControlCard>
          <ControlCard title="Allowed products" className="md:col-span-2 xl:col-span-2">
            <AllowedProductsForm agencyId={agency.id} current={agency.allowed_products} />
          </ControlCard>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title="Members" count={agency.agency_members.length}>
          <Card className="overflow-hidden py-0">
            {agency.agency_members.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No members</EmptyTitle>
              </Empty>
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
                      <TableCell className="max-w-64">
                        <p className="truncate font-medium">{member.profiles?.full_name ?? "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-mono text-foreground">{member.username}</span> · {member.profiles?.email}
                        </p>
                      </TableCell>
                      <TableCell className="capitalize">{member.role_in_agency}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(member.status, { removed: "neutral" })} className="capitalize">
                          {member.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </Section>

        <Section
          id="markups"
          title="Markup rules"
          className="scroll-mt-6"
          badge={
            pendingMarkupRequests.length > 0 ? (
              <Badge variant="warning" className="tabular-nums">
                {pendingMarkupRequests.length} pending
              </Badge>
            ) : null
          }
        >
          <Card className="overflow-hidden py-0">
            {pendingMarkupRequests.length > 0 ? (
              <ul className="divide-y divide-border border-b border-border bg-brand-gold/5">
                {pendingMarkupRequests.map((request) => {
                  const current = currentMarkupByScope.get(request.item_type ?? "all");
                  const requester = request.requester as { full_name: string | null; email: string } | null;
                  return (
                    <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 space-y-2">
                        <ScopeBadge itemType={request.item_type} />
                        <MarkupChange
                          current={current}
                          fallback={request.item_type === null ? null : currentMarkupByScope.get("all")}
                          request={request}
                        />
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {requester?.full_name ?? requester?.email ?? "—"} ·{" "}
                          {format(new Date(request.requested_at), "d MMM yyyy, HH:mm")}
                        </p>
                      </div>
                      <div className="w-full sm:w-auto sm:min-w-56">
                        <MarkupRequestReview requestId={request.id} agencyId={agency.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {markups.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Percent />
                </EmptyMedia>
                <EmptyTitle>No markup rules</EmptyTitle>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applies to</TableHead>
                    <TableHead numeric>Markup</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markups.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>{scopeLabel(rule.item_type)}</TableCell>
                      <TableCell numeric className="font-medium tabular-nums">
                        {markupLabel(rule.markup_type, rule.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {decidedMarkupRequests.length > 0 ? (
              <div className="border-t border-border">
                <h3 className="px-4 pt-3 text-xs font-medium text-muted-foreground">Recent decisions</h3>
                <ul className="divide-y divide-border">
                  {decidedMarkupRequests.map((request) => (
                    <li key={request.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{scopeLabel(request.item_type)}</span>
                        <span className="mx-1.5 text-muted-foreground">·</span>
                        <span className="tabular-nums">{requestedLabel(request)}</span>
                        {request.review_note ? (
                          <p className="text-xs break-words text-muted-foreground">{request.review_note}</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge variant={statusBadgeVariant(request.status)} className="capitalize">
                          {request.status}
                        </Badge>
                        {request.reviewed_at ? (
                          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            {format(new Date(request.reviewed_at), "d MMM yyyy")}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </Section>
      </div>

      <Section title="Wallet transactions" count={wallet.transactions.length}>
        <Card className="overflow-hidden py-0">
          {wallet.transactions.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Wallet />
              </EmptyMedia>
              <EmptyTitle>No wallet activity</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead numeric>Amount</TableHead>
                  <TableHead numeric>Balance after</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallet.transactions.map((tx) => {
                  const amount = Number(tx.amount);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                        {format(new Date(tx.created_at), "d MMM yyyy, HH:mm")}
                      </TableCell>
                      <TableCell className="capitalize">{tx.type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="font-mono text-xs">{tx.order?.order_number ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{tx.note ?? "—"}</TableCell>
                      <TableCell
                        numeric
                        className={cn("font-medium tabular-nums", amount < 0 ? "text-destructive" : "text-primary")}
                      >
                        {amount < 0 ? "−" : "+"}
                        {usd(Math.abs(amount))}
                      </TableCell>
                      <TableCell numeric className="text-muted-foreground tabular-nums">
                        {usd(Number(tx.balance_after))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section
          title="Earnings to review"
          badge={
            pendingEntries.length > 0 ? (
              <Badge variant="warning" className="tabular-nums">
                {pendingEntries.length}
              </Badge>
            ) : null
          }
        >
          <Card>
            <CardContent>
              {pendingEntries.length === 0 ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <CheckCheck />
                  </EmptyMedia>
                  <EmptyTitle>Nothing to review</EmptyTitle>
                </Empty>
              ) : (
                <CommissionEntryReview agencyId={agency.id} entries={pendingEntries} />
              )}
            </CardContent>
          </Card>
        </Section>

        <Section title="Earnings balance">
          <StatRail className="sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            <StatRailItem label="Total earned" value={usd(earnings.totalEarned)} />
            <StatRailItem label="In review" value={usd(earnings.inReview)} tone="warn" />
            <StatRailItem label="Available to withdraw" value={usd(earnings.available)} tone="primary" />
            <StatRailItem label="Requested" value={usd(earnings.requested)} />
            <StatRailItem label="Paid out" value={usd(earnings.paidOut)} />
          </StatRail>
        </Section>
      </div>

      <Section title="Wallet top-ups" count={topupRequests.length}>
        <Card className="overflow-hidden py-0">
          {topupRequests.length === 0 ? (
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
                  <TableHead>Filed</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead numeric>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topupRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {format(new Date(request.requested_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{request.method.replace(/_/g, " ")}</span>
                      <Badge variant="outline" className="ml-1.5 capitalize">
                        {request.rail}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {request.reference ?? request.provider_ref ?? "—"}
                    </TableCell>
                    <TableCell numeric className="font-medium tabular-nums">
                      {usd(Number(request.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(request.status, { cancelled: "neutral" })} className="capitalize">
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell numeric>
                      <div className="flex items-start justify-end gap-1.5">
                        {proofUrls.has(request.id) ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="View receipt"
                            title="View receipt"
                            render={
                              <a href={proofUrls.get(request.id)} target="_blank" rel="noopener noreferrer" />
                            }
                          >
                            <Receipt />
                          </Button>
                        ) : null}
                        {request.status === "pending" && request.rail === "offline" ? (
                          <TopupReview agencyId={agency.id} requestId={request.id} />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Section>

      <Section title="Payout requests" count={payoutRequests.length}>
        <Card className="overflow-hidden py-0">
          {payoutRequests.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Banknote />
              </EmptyMedia>
              <EmptyTitle>No payout requests</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead numeric>Amount</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {format(new Date(request.requested_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell numeric className="font-medium tabular-nums">
                      {usd(Number(request.amount))}
                    </TableCell>
                    <TableCell>
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
                      <Badge variant={statusBadgeVariant(request.status)} className="capitalize">
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell numeric>
                      <PayoutRequestActions agencyId={agency.id} requestId={request.id} status={request.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Section>

      <Section title="Commission entries" count={commissionEntryTotal}>
        <Card className="overflow-hidden py-0">
          {commissionEntries.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>No commission entries</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead numeric>Rate</TableHead>
                  <TableHead numeric>Commission</TableHead>
                  <TableHead numeric>Markup</TableHead>
                  <TableHead numeric>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <p className="font-mono text-xs font-medium">{entry.order?.order_number ?? "—"}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(entry.created_at), "d MMM yyyy")}
                      </p>
                    </TableCell>
                    <TableCell numeric className="tabular-nums">
                      {entry.rate_applied}%
                    </TableCell>
                    <TableCell numeric className="tabular-nums">
                      {usd(Number(entry.commission_amount))}
                    </TableCell>
                    <TableCell numeric className="tabular-nums">
                      {usd(Number(entry.markup_amount))}
                    </TableCell>
                    <TableCell numeric className="font-medium tabular-nums">
                      {usd(Number(entry.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(entry.status, ENTRY_STATUS)} className="capitalize">
                        {entry.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {commissionEntryTotal > ADMIN_PAGE_SIZE ? (
            <div className="border-t border-border px-4 py-3">
              <Pager page={entriesPage} total={commissionEntryTotal} hrefFor={entriesHref} />
            </div>
          ) : null}
        </Card>
      </Section>

      <Section title="Commission payouts" count={payouts.length}>
        <Card className="overflow-hidden py-0">
          {payouts.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Banknote />
              </EmptyMedia>
              <EmptyTitle>No payouts</EmptyTitle>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paid</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead numeric>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {format(new Date(payout.paid_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>{payout.method ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{payout.payout_reference ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {payout.period_start && payout.period_end
                        ? `${format(new Date(payout.period_start), "d MMM")} – ${format(new Date(payout.period_end), "d MMM yyyy")}`
                        : "—"}
                    </TableCell>
                    <TableCell numeric className="font-medium tabular-nums">
                      {usd(Number(payout.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  badge,
  id,
  className,
  children,
}: {
  title: string;
  count?: number;
  badge?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("min-w-0 space-y-3", className)}>
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {count ? (
          <Badge variant="neutral" className="tabular-nums">
            {count}
          </Badge>
        ) : null}
        {badge}
      </div>
      {children}
    </section>
  );
}

function ControlCard({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
