export type CountryDialCode = { iso2: string; name: string; dial: string; iconIso2: string };

const RAW: Array<[string, string, string]> = [
  ["SO", "Somalia", "+252"],
  // Somaliland isn't an ISO 3166-1 country (ships no flag asset of its own) —
  // reuses Somalia's flag icon, only the dial-code entry itself is distinct.
  ["SOM", "Somaliland", "+252"],
  ["AE", "United Arab Emirates", "+971"],
  ["SA", "Saudi Arabia", "+966"],
  ["KE", "Kenya", "+254"],
  ["ET", "Ethiopia", "+251"],
  ["DJ", "Djibouti", "+253"],
  ["EG", "Egypt", "+20"],
  ["TR", "Turkey", "+90"],
  ["QA", "Qatar", "+974"],
  ["KW", "Kuwait", "+965"],
  ["OM", "Oman", "+968"],
  ["BH", "Bahrain", "+973"],
  ["JO", "Jordan", "+962"],
  ["YE", "Yemen", "+967"],
  ["SD", "Sudan", "+249"],
  ["UG", "Uganda", "+256"],
  ["TZ", "Tanzania", "+255"],
  ["RW", "Rwanda", "+250"],
  ["GB", "United Kingdom", "+44"],
  ["US", "United States", "+1"],
  ["CA", "Canada", "+1"],
  ["DE", "Germany", "+49"],
  ["FR", "France", "+33"],
  ["IT", "Italy", "+39"],
  ["NL", "Netherlands", "+31"],
  ["SE", "Sweden", "+46"],
  ["NO", "Norway", "+47"],
  ["IN", "India", "+91"],
  ["PK", "Pakistan", "+92"],
  ["BD", "Bangladesh", "+880"],
  ["CN", "China", "+86"],
  ["MY", "Malaysia", "+60"],
  ["ID", "Indonesia", "+62"],
  ["ZA", "South Africa", "+27"],
  ["NG", "Nigeria", "+234"],
  ["AU", "Australia", "+61"],
];

export const COUNTRY_DIAL_CODES: CountryDialCode[] = RAW.map(([iso2, name, dial]) => ({
  iso2,
  name,
  dial,
  iconIso2: (iso2.length > 2 ? iso2.slice(0, 2) : iso2).toLowerCase(),
}));

export const DEFAULT_DIAL_CODE = "+252";

/** Longest-dial-prefix match against a stored value like "+252615551234". */
export function splitPhoneValue(value: string): { dial: string; number: string } {
  const trimmed = value.trim();
  if (!trimmed.startsWith("+")) return { dial: DEFAULT_DIAL_CODE, number: trimmed.replace(/\D/g, "") };

  const sorted = [...COUNTRY_DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);
  const match = sorted.find((c) => trimmed.startsWith(c.dial));
  if (!match) return { dial: DEFAULT_DIAL_CODE, number: trimmed.replace(/\D/g, "") };

  return { dial: match.dial, number: trimmed.slice(match.dial.length).replace(/\D/g, "") };
}
