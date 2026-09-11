import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getTopupOptions } from "@/modules/payments/topup";
import { FundWalletDialog } from "./fund-wallet-dialog";

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

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
  const remaining = available - due;
  const options = getTopupOptions();

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="divide-y divide-border px-0 py-0">
        <div className="space-y-2 px-4 py-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Agency balance</span>
            <span className="font-medium tabular-nums">{money(available, currency)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Amount due</span>
            <span className="font-medium tabular-nums">{money(due, currency)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
            {shortfall > 0 ? (
              <>
                <span className="font-medium text-destructive">Short by</span>
                <span className="font-heading text-lg font-bold tabular-nums text-destructive">
                  {money(shortfall, currency)}
                </span>
              </>
            ) : (
              <>
                <span className="font-medium">Balance after payment</span>
                <span className="font-heading text-lg font-bold tabular-nums text-primary">
                  {money(remaining, currency)}
                </span>
              </>
            )}
          </div>
        </div>

        {pendingTopupTotal > 0 ? (
          <div className="flex items-center justify-between gap-3 bg-brand-gold/5 px-4 py-2.5 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="size-3.5 text-brand-gold" /> Top-up filed, awaiting STS
            </span>
            <span className="flex items-center gap-2 font-medium tabular-nums">
              {money(pendingTopupTotal, currency)}
              <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">Pending</Badge>
            </span>
          </div>
        ) : null}

        <div className="px-4 py-4">
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
        </div>
      </CardContent>
    </Card>
  );
}
