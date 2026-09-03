/**
 * How money leaves STS for an agency — the mirror of the offline funding
 * methods in topup.ts, which describe the same rails pointing inward.
 *
 * No `server-only` here on purpose: the admin picks one of these when
 * recording a transfer, and both portals render the label back, so the list
 * has to cross to the client. There is no online rail yet; when a
 * disbursement gateway is connected it joins this list the same way
 * getTopupOptions() derives its online methods from the payment registry.
 */

export const PAYOUT_METHODS = [
  { id: "bank_transfer", label: "Bank transfer" },
  { id: "evc_plus", label: "EVC Plus / mobile money" },
  { id: "cash_office", label: "Cash at an STS office" },
] as const;

export type PayoutMethodId = (typeof PAYOUT_METHODS)[number]["id"];

export function isPayoutMethod(id: string): boolean {
  return PAYOUT_METHODS.some((m) => m.id === id);
}

export function payoutMethodLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return PAYOUT_METHODS.find((m) => m.id === id)?.label ?? id;
}
