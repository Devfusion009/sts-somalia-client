import Link from "next/link";
import { ArrowRight, Link2, Receipt } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpc } from "@/lib/trpc/server";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { money, shortDate } from "@/lib/money";
import { CopyLinkButton } from "./links/copy-link-button";

export const metadata = { title: "Dashboard" };

/** Reversed commissions read as a loss, not a neutral state. */
const CONVERSION_VARIANT = { reversed: "destructive" } as const;

export default async function AffiliateDashboardPage() {
  await requireUser();
  const trpc = await getServerTrpc();
  const { affiliate, links, conversions, payouts } = await trpc.affiliates.dashboard.query();

  if (!affiliate) {
    return (
      <Alert variant="destructive">
        <AlertDescription>No affiliate account.</AlertDescription>
      </Alert>
    );
  }

  const totalClicks = links.reduce((sum, l) => sum + l.clicks_count, 0);
  const pending = conversions.filter((c) => c.status === "pending");
  const counted = conversions.filter((c) => c.status !== "reversed");

  // Computed live, not a denormalized counter — affiliates.total_earned/
  // total_paid were dropped (see migration 20260814000001): they never had
  // a writer anywhere, always silently read $0.00. "Earned" is every
  // conversion not reversed (approved + paid); "paid out" is the sum of
  // actual payout records, not the sum of paid-status conversions — those
  // two can legitimately differ (an admin payout amount is a real-world
  // round figure, not required to exactly equal the conversions it settles).
  const totalEarned = counted.reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const totalPending = pending.reduce((sum, c) => sum + Number(c.commission_amount), 0);
  const totalPaidOut = payouts.reduce((sum, p) => sum + Number(p.amount), 0);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // Prefer the homepage link as "the" referral link; otherwise the newest one.
  const primaryLink = links.find((l) => l.target_path === "/") ?? links[0];
  const referralUrl = primaryLink ? `${siteUrl}/r/${primaryLink.code}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        status={
          <Badge variant={statusBadgeVariant(affiliate.status)} className="capitalize">
            {affiliate.status.replace(/_/g, " ")}
          </Badge>
        }
        meta={
          <span className="tabular-nums">
            Code <span className="font-mono font-medium text-foreground">{affiliate.referral_code}</span> ·{" "}
            {affiliate.commission_rate}% commission
          </span>
        }
      />

      <StatRail>
        <StatRailItem label="Clicks" value={totalClicks.toLocaleString("en-US")} />
        <StatRailItem
          label="Conversions"
          value={counted.length}
          sub={pending.length > 0 ? `${pending.length} pending` : undefined}
        />
        <StatRailItem label="Earned" value={money(totalEarned, "USD")} sub={`${money(totalPaidOut, "USD")} paid out`} />
        <StatRailItem
          label="Pending"
          value={money(totalPending, "USD")}
          tone={totalPending > 0 ? "warn" : undefined}
        />
      </StatRail>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referral link</CardTitle>
          {referralUrl ? (
            <CardAction>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="All links"
                title="All links"
                render={<Link href="/affiliate/links" />}
              >
                <ArrowRight />
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {referralUrl ? (
            <InputGroup className="max-sm:h-10">
              <InputGroupAddon>
                <Link2 aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                readOnly
                value={referralUrl}
                aria-label="Referral link"
                className="font-mono text-xs md:text-xs"
              />
              <InputGroupAddon align="inline-end">
                <CopyLinkButton url={referralUrl} />
              </InputGroupAddon>
            </InputGroup>
          ) : (
            <Empty>
              <EmptyMedia variant="icon">
                <Link2 />
              </EmptyMedia>
              <EmptyTitle>No links</EmptyTitle>
              <EmptyContent>
                <Button render={<Link href="/affiliate/links" />}>Create a link</Button>
              </EmptyContent>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Commissions
            {conversions.length > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {conversions.length}
              </Badge>
            ) : null}
          </CardTitle>
          {payouts.length > 0 ? (
            <CardAction>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Payouts"
                title="Payouts"
                render={<Link href="/affiliate/payouts" />}
              >
                <ArrowRight />
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        {conversions.length === 0 ? (
          <CardContent className="pb-6">
            <Empty>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>No commissions</EmptyTitle>
            </Empty>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">{shortDate(c.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs uppercase">{c.order_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(c.status, CONVERSION_VARIANT)} className="capitalize">
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell
                    numeric
                    className={c.status === "reversed" ? "text-muted-foreground line-through" : "font-medium"}
                  >
                    {money(c.commission_amount, "USD")}
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
