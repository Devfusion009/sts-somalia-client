import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
 */
export function WalletPaymentPanel({
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
  const options = getTopupOptions();

  return (
    <Card>
      <CardContent className="space-y-3">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Agency balance available</dt>
            <dd className="font-medium tabular-nums">
              {currency} {available.toFixed(0)}
            </dd>
          </div>
          {shortfall > 0 ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Amount due</dt>
                <dd className="font-medium tabular-nums">
                  {currency} {due.toFixed(0)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5">
                <dt className="font-medium text-destructive">Short by</dt>
                <dd className="font-semibold tabular-nums text-destructive">
                  {currency} {shortfall.toFixed(0)}
                </dd>
              </div>
            </>
          ) : null}
          {pendingTopupTotal > 0 ? (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Top-up filed</dt>
              <dd className="flex items-center gap-2 tabular-nums">
                {currency} {pendingTopupTotal.toFixed(0)}
                <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">
                  Awaiting STS
                </Badge>
              </dd>
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
          <p className="text-sm text-muted-foreground">
            Only the agency owner or an admin can add money.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
