export type ProviderCategory = "payments" | "flights" | "hotels" | "visa" | "visa_processing";

export type ProviderCredentialField = {
  key: string;
  label: string;
  placeholder?: string;
  /** Rendered as a dropdown; the saved value is always one of these. */
  options?: { value: string; label: string }[];
  /** Identifiers (not secrets) render as plain text instead of a masked field. */
  plain?: boolean;
  /** May be left blank on save. */
  optional?: boolean;
};

export type ProviderDefinition = {
  key: string;
  category: ProviderCategory;
  name: string;
  description: string;
  selfServe: boolean;
  approvalNote?: string;
  docsUrl: string;
  signupUrl: string;
  credentialFields: ProviderCredentialField[];
  /** Sub-heading inside a category tab, e.g. the card processors versus mobile money. */
  group?: string;
};

/**
 * Every provider an admin can activate. Deliberately scoped to providers
 * this codebase actually calls live (src/lib/provider-runtime/*) — no
 * catalog entries for providers we haven't wired, since a listed-but-dead
 * toggle would be a half-finished feature. Enterprise suppliers (Booking.com,
 * Amadeus, Skyscanner, Expedia) need weeks-long partner vetting before they
 * issue a key at all, so they're out of scope for a self-serve "add and
 * activate" flow — noted here for anyone tempted to add them later.
 */
export const PROVIDER_CATALOG: ProviderDefinition[] = [
  {
    key: "stripe",
    category: "payments",
    group: "Cards",
    name: "Stripe",
    description: "Card payments at checkout; funds settle to the connected Stripe account.",
    selfServe: true,
    docsUrl: "https://docs.stripe.com/keys",
    signupUrl: "https://dashboard.stripe.com/register",
    credentialFields: [
      { key: "secret_key", label: "Secret key", placeholder: "sk_live_..." },
      { key: "webhook_secret", label: "Webhook signing secret", placeholder: "whsec_..." },
    ],
  },
  {
    key: "razorpay",
    category: "payments",
    group: "Cards",
    name: "Razorpay",
    description: "Card payments at checkout; funds settle to the connected Razorpay account.",
    selfServe: true,
    docsUrl: "https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/",
    signupUrl: "https://dashboard.razorpay.com/signup",
    credentialFields: [
      { key: "key_id", label: "Key ID", placeholder: "rzp_live_..." },
      { key: "key_secret", label: "Key secret" },
      { key: "webhook_secret", label: "Webhook secret" },
    ],
  },
  {
    key: "sifalo",
    category: "payments",
    group: "Mobile money and cards",
    name: "Sifalo Pay",
    description: "EVC Plus, ZAAD, Sahal, eDahab, Premier Wallet, Visa and Mastercard through one hosted checkout.",
    selfServe: true,
    docsUrl: "https://developer.sifalopay.com",
    signupUrl: "https://pay.sifalo.com",
    credentialFields: [
      { key: "api_user", label: "API user" },
      { key: "api_key", label: "API key" },
    ],
  },
  {
    key: "waafi",
    category: "payments",
    group: "WaafiPay",
    name: "WaafiPay",
    description: "EVC Plus, ZAAD and Sahal mobile money, through WaafiPay's hosted payment page or a direct wallet push.",
    selfServe: false,
    docsUrl: "https://docs.waafipay.com/",
    signupUrl: "https://waafipay.com/",
    credentialFields: [
      {
        key: "environment",
        label: "Environment",
        options: [
          { value: "production", label: "Production" },
          { value: "sandbox", label: "Sandbox" },
        ],
      },
      { key: "merchant_uid", label: "Merchant UID", placeholder: "M0000000", plain: true },
      { key: "api_user_id", label: "API user ID", plain: true },
      { key: "api_key", label: "API key", placeholder: "API-..." },
      { key: "store_id", label: "Store ID", plain: true, optional: true },
      { key: "hpp_key", label: "HPP key", placeholder: "HPP-...", optional: true },
    ],
  },
  {
    key: "edahab",
    category: "payments",
    group: "Mobile money",
    name: "eDahab",
    description: "Dahabshiil eDahab mobile money.",
    selfServe: false,
    docsUrl: "https://edahab.net/",
    signupUrl: "https://edahab.net/",
    credentialFields: [
      { key: "api_key", label: "API key" },
      { key: "agent_code", label: "Agent code" },
    ],
  },
  {
    key: "duffel",
    category: "flights",
    name: "Duffel",
    description: "Live flight search and fares across hundreds of airlines. Already the platform's flight engine.",
    selfServe: true,
    docsUrl: "https://duffel.com/docs",
    signupUrl: "https://app.duffel.com/join",
    credentialFields: [{ key: "api_key", label: "API Key", placeholder: "duffel_live_..." }],
  },
  {
    key: "hotelbeds",
    category: "hotels",
    name: "Hotelbeds",
    description: "Wholesale hotel inventory (bedbank) — blends external availability into hotel search alongside your own partner hotels.",
    selfServe: true,
    docsUrl: "https://developer.hotelbeds.com/documentation/hotels/booking-api/",
    signupUrl: "https://developer.hotelbeds.com/",
    credentialFields: [
      { key: "api_key", label: "API Key" },
      { key: "api_secret", label: "API Secret" },
    ],
  },
  {
    key: "zylalabs_visa",
    category: "visa",
    name: "Zylalabs Visa Checker",
    description: "Visa-free / visa-on-arrival / eVisa / visa-required lookup by passport nationality, shown to travelers on visa product pages.",
    selfServe: true,
    docsUrl: "https://www.zylalabs.com/api-marketplace/travel+&+transportation/visa+checker+api/2154",
    signupUrl: "https://www.zylalabs.com/api-marketplace/travel+&+transportation/visa+checker+api/2154",
    credentialFields: [{ key: "api_key", label: "Bearer API Key" }],
  },
  {
    key: "sandbox",
    category: "visa_processing",
    name: "Sandbox (testing)",
    description: "In-process fake visa-processing partner — no real vendor, no network calls. Proves the partner contract works before a real vendor is signed.",
    selfServe: true,
    docsUrl: "internal:visa-processing-sandbox",
    signupUrl: "internal:visa-processing-sandbox",
    credentialFields: [{ key: "webhook_secret", label: "Webhook secret", placeholder: "any value — used to sign test webhook calls" }],
  },
  {
    key: "custom",
    category: "visa_processing",
    name: "Custom REST partner",
    description: "Any visa-processing vendor with an ordinary REST + webhook API, wired up by configuration rather than a new adapter.",
    selfServe: true,
    docsUrl: "internal:visa-processing-custom",
    signupUrl: "internal:visa-processing-custom",
    credentialFields: [
      { key: "auth_header_name", label: "Auth header name", placeholder: "Authorization" },
      { key: "auth_header_value", label: "Auth header value", placeholder: "Bearer sk_live_..." },
      { key: "webhook_secret", label: "Webhook secret", placeholder: "the vendor's HMAC signing secret" },
    ],
  },
];

export function getProvider(key: string): ProviderDefinition | undefined {
  return PROVIDER_CATALOG.find((p) => p.key === key);
}

/** Providers that serve the same checkout slot; activating one switches the others off. */
export const EXCLUSIVE_PROVIDER_GROUPS: string[][] = [["stripe", "razorpay"]];

export function providersByCategory(category: ProviderCategory): ProviderDefinition[] {
  return PROVIDER_CATALOG.filter((p) => p.category === category);
}
