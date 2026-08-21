import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import {
  getAgencyForAdmin,
  getAgencyWallet,
  getAgencyCommissionEntries,
  getAgencyCommissionPayouts,
  getAgencyMarkups,
} from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const VERTICAL_LABELS: Record<string, string> = {
  hotel: "Hotels",
  flight: "Flights",
  visa: "Visa",
  umrah: "Umrah",
  hall: "Events & Halls",
};

function money(amount: number) {
  return `USD ${amount.toFixed(2)}`;
}

export default async function AdminAgencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;

  const agency = await getAgencyForAdmin(id);
  if (!agency) notFound();

  const [wallet, commissionEntries, payouts, markups, tiers] = await Promise.all([
    getAgencyWallet(agency.id),
    getAgencyCommissionEntries(agency.id),
    getAgencyCommissionPayouts(agency.id),
    getAgencyMarkups(agency.id),
    getAgencyTiers(),
  ]);

  const totalEarned = commissionEntries
    .filter((e) => e.status !== "reversed")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 gap-1 text-muted-foreground"
            render={<Link href="/admin/agencies" />}
          >
            <ArrowLeft className="size-3.5" /> All agencies
          </Button>
          <h1 className="font-heading text-2xl font-semibold">{agency.name}</h1>
          <p className="text-sm text-muted-foreground">
            {agency.contact_email}
            {agency.contact_phone ? ` · ${agency.contact_phone}` : ""}
          </p>
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

        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b border-border !py-4">
            <CardTitle className="text-base">Markup Rules (agency-managed)</CardTitle>
          </CardHeader>
          {markups.length === 0 ? (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No markup rules — this agency sells at STS net prices.
            </CardContent>
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
                    <TableCell>
                      {rule.item_type === null
                        ? "All services (default)"
                        : (VERTICAL_LABELS[rule.item_type] ?? rule.item_type)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {rule.markup_type === "percent"
                        ? `${Number(rule.value)}%`
                        : money(Number(rule.value))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
