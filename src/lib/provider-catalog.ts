export type ProviderCategory = "flights" | "hotels" | "visa";

export type ProviderCredentialField = {
  key: string;
  label: string;
  placeholder?: string;
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
];

export function getProvider(key: string): ProviderDefinition | undefined {
  return PROVIDER_CATALOG.find((p) => p.key === key);
}

export function providersByCategory(category: ProviderCategory): ProviderDefinition[] {
  return PROVIDER_CATALOG.filter((p) => p.category === category);
}
