export const COUNTRY_NAMES: Record<string, string> = {
  SO: "Somalia",
  AE: "United Arab Emirates",
  TR: "Turkey",
  KE: "Kenya",
  SA: "Saudi Arabia",
};

export function countryName(code: string) {
  return COUNTRY_NAMES[code] ?? code;
}
