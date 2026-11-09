import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/money";
import { getTopupOptions } from "@/modules/payments/topup";
import { FundWalletDialog } from "./fund-wallet-dialog";

/**
 * The agency-balance step of a desk payment.
 *
 * Decides server-side whether the wallet can cover what's due and only ever
 * offers the action that can succeed: the pay form when it can, "Add money"
 * when it can't. The old shape — an enabled Pay button that fails with a
 * sentence about topping up — left the agent at the counter with nowhere to
 * go and the customer waiting.
 *
 * Laid out as a receipt — one line item per row, the running math ending in
 * a single emphasized total — rather than a row of same-weight stat boxes:
 * that shape reads as a checkout summary the agent already trusts, and
 * (unlike a multi-column stat grid) a single wide amount can never force a
 * whole row wider than the page.
 */
export async function WalletPaymentPanel({
  due,
  available,
  currency,
  canTopUp,
  pendingTopupTotal,
  returnTo,
  children,
}: {
  due: number;
  available: number;
  currency: string;
  canTopUp: boolean;
  /** Top-ups already filed and awaiting STS, so the agent isn't asked twice. */
  pendingTopupTotal: number;
  returnTo: string;
  /** The pay form, rendered only once the balance covers the amount due. */
  children: React.ReactNode;
}) {
  const shortfall = Math.max(due - available, 0);
  const remaining = available - due;
  const options = await getTopupOptions();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay from agency balance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Available to spend</dt>
            <dd className="tabular-nums">{money(available, currency)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Amount due</dt>
            <dd className="tabular-nums">{money(due, currency)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            {shortfall > 0 ? (
              <>
                <dt className="font-medium text-destructive">Short by</dt>
                <dd className="font-heading text-base font-semibold tabular-nums text-destructive">
                  {money(shortfall, currency)}
                </dd>
              </>
            ) : (
              <>
                <dt className="font-medium">Available after payment</dt>
                <dd className="font-heading text-base font-semibold tabular-nums">
                  {money(remaining, currency)}
                </dd>
              </>
            )}
          </div>
          {pendingTopupTotal > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                Top-up <Badge variant="warning">Pending</Badge>
              </dt>
              <dd className="tabular-nums">{money(pendingTopupTotal, currency)}</dd>
            </div>
          ) : null}
        </dl>

        {shortfall === 0 ? (
          children
        ) : canTopUp ? (
          <FundWalletDialog
            amount={shortfall}
            currency={currency}
            returnTo={returnTo}
            offline={options.offline}
            online={options.online}
            bankTransfer={options.bankTransfer}
          />
        ) : (
          <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            Top-ups need the agency owner or an admin.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
