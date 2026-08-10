/**
 * Payer details a customer can save for reuse at checkout.
 *
 * No card is stored. The live gateways are WAAFI (EVC Plus / ZAAD / Sahal),
 * eDahab, manual bank transfer, cash at office, and Stripe hosted Checkout —
 * none of which return a reusable card token in the current integration. What
 * a Somali customer actually retypes every time is their wallet number, so
 * that is what we remember.
 *
 * `payment_methods.provider` holds the WALLET id for these rows (evc_plus,
 * zaad, …) rather than the gateway name, so checkout can match a saved number
 * to the method the customer picked without a second lookup table. The column
 * keeps its original meaning for future Stripe rows, which carry a
 * provider_payment_method_id instead.
 *
 * Deliberately NOT server-only: the add/edit form is a Client Component and
 * needs this list.
 */

export type SavableWallet = {
  id: string;
  label: string;
  description: string;
  /** Country dialling prefix shown as a hint, not enforced. */
  hint: string;
};

export const SAVABLE_WALLETS: SavableWallet[] = [
  {
    id: "evc_plus",
    label: "EVC Plus",
    description: "Hormuud mobile money",
    hint: "e.g. 61 1234567",
  },
  { id: "zaad", label: "ZAAD", description: "Telesom mobile money", hint: "e.g. 63 1234567" },
  { id: "sahal", label: "Sahal", description: "Golis mobile money", hint: "e.g. 90 1234567" },
  { id: "edahab", label: "eDahab", description: "Somtel eDahab", hint: "e.g. 65 1234567" },
];

export const WALLET_LABELS = new Map(SAVABLE_WALLETS.map((w) => [w.id, w.label]));

/**
 * Masks a wallet number for display.
 *
 * A saved payment identifier shown in full on a page that might be
 * screen-shared or shoulder-surfed is a needless disclosure; the last three
 * digits are enough for the owner to tell two of their own numbers apart.
 */
export function maskMsisdn(msisdn: string | null): string {
  if (!msisdn) return "—";
  const trimmed = msisdn.replace(/\s+/g, "");
  if (trimmed.length <= 3) return trimmed;
  return `${"•".repeat(Math.max(3, trimmed.length - 3))}${trimmed.slice(-3)}`;
}
