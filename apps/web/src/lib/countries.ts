export const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AO: "Angola", AR: "Argentina",
  AM: "Armenia", AU: "Australia", AT: "Austria", AZ: "Azerbaijan", BH: "Bahrain",
  BD: "Bangladesh", BY: "Belarus", BE: "Belgium", BJ: "Benin", BT: "Bhutan",
  BO: "Bolivia", BA: "Bosnia and Herzegovina", BW: "Botswana", BR: "Brazil",
  BN: "Brunei", BG: "Bulgaria", BF: "Burkina Faso", BI: "Burundi", KH: "Cambodia",
  CM: "Cameroon", CA: "Canada", CV: "Cape Verde", CF: "Central African Republic",
  TD: "Chad", CL: "Chile", CN: "China", CO: "Colombia", KM: "Comoros",
  CG: "Congo", CD: "DR Congo", CR: "Costa Rica", CI: "Côte d'Ivoire", HR: "Croatia",
  CU: "Cuba", CY: "Cyprus", CZ: "Czechia", DK: "Denmark", DJ: "Djibouti",
  DO: "Dominican Republic", EC: "Ecuador", EG: "Egypt", SV: "El Salvador",
  GQ: "Equatorial Guinea", ER: "Eritrea", EE: "Estonia", SZ: "Eswatini",
  ET: "Ethiopia", FJ: "Fiji", FI: "Finland", FR: "France", GA: "Gabon",
  GM: "Gambia", GE: "Georgia", DE: "Germany", GH: "Ghana", GR: "Greece",
  GT: "Guatemala", GN: "Guinea", GW: "Guinea-Bissau", GY: "Guyana", HT: "Haiti",
  HN: "Honduras", HK: "Hong Kong", HU: "Hungary", IS: "Iceland", IN: "India",
  ID: "Indonesia", IR: "Iran", IQ: "Iraq", IE: "Ireland", IL: "Israel",
  IT: "Italy", JM: "Jamaica", JP: "Japan", JO: "Jordan", KZ: "Kazakhstan",
  KE: "Kenya", KW: "Kuwait", KG: "Kyrgyzstan", LA: "Laos", LV: "Latvia",
  LB: "Lebanon", LS: "Lesotho", LR: "Liberia", LY: "Libya", LT: "Lithuania",
  LU: "Luxembourg", MG: "Madagascar", MW: "Malawi", MY: "Malaysia", MV: "Maldives",
  ML: "Mali", MT: "Malta", MR: "Mauritania", MU: "Mauritius", MX: "Mexico",
  MD: "Moldova", MN: "Mongolia", ME: "Montenegro", MA: "Morocco", MZ: "Mozambique",
  MM: "Myanmar", NA: "Namibia", NP: "Nepal", NL: "Netherlands", NZ: "New Zealand",
  NI: "Nicaragua", NE: "Niger", NG: "Nigeria", MK: "North Macedonia", NO: "Norway",
  OM: "Oman", PK: "Pakistan", PS: "Palestine", PA: "Panama", PG: "Papua New Guinea",
  PY: "Paraguay", PE: "Peru", PH: "Philippines", PL: "Poland", PT: "Portugal",
  QA: "Qatar", RO: "Romania", RU: "Russia", RW: "Rwanda", SA: "Saudi Arabia",
  SN: "Senegal", RS: "Serbia", SC: "Seychelles", SL: "Sierra Leone", SG: "Singapore",
  SK: "Slovakia", SI: "Slovenia", SO: "Somalia", ZA: "South Africa",
  KR: "South Korea", SS: "South Sudan", ES: "Spain", LK: "Sri Lanka", SD: "Sudan",
  SR: "Suriname", SE: "Sweden", CH: "Switzerland", SY: "Syria", TW: "Taiwan",
  TJ: "Tajikistan", TZ: "Tanzania", TH: "Thailand", TL: "Timor-Leste", TG: "Togo",
  TN: "Tunisia", TR: "Turkey", TM: "Turkmenistan", UG: "Uganda", UA: "Ukraine",
  AE: "United Arab Emirates", GB: "United Kingdom", US: "United States",
  UY: "Uruguay", UZ: "Uzbekistan", VE: "Venezuela", VN: "Vietnam", YE: "Yemen",
  ZM: "Zambia", ZW: "Zimbabwe",
};

export function countryName(code: string) {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

/** ISO 3166-1 alpha-2 → emoji flag (regional indicator symbols; no image assets). */
export function countryFlag(code: string) {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** [code, name] pairs sorted by name — for nationality/country selects. */
export const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES).sort((a, b) =>
  a[1].localeCompare(b[1])
);

export const NATIONALITY_DEFAULT = "SO";

/** Common names/abbreviations people search with that the ISO name alone won't match. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  AE: ["uae", "emirates", "dubai", "abu dhabi"],
  TR: ["turkiye", "türkiye"],
  SA: ["ksa", "saudi"],
  GB: ["uk", "britain", "england"],
  US: ["usa", "america"],
  CD: ["dr congo", "congo-kinshasa", "drc"],
  CG: ["congo-brazzaville"],
  CZ: ["czech republic"],
  KR: ["south korea", "korea"],
};

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Name + code + known aliases, diacritic-stripped, for matching free-text search input. */
export function countrySearchText(code: string) {
  const cc = code.toUpperCase();
  const parts = [countryName(cc), cc, ...(COUNTRY_ALIASES[cc] ?? [])];
  return stripDiacritics(parts.join(" ")).toLowerCase();
}

export function normalizeSearchTerm(value: string) {
  return stripDiacritics(value.trim()).toLowerCase();
}

/** ITU-T E.164 calling code per ISO 3166-1 alpha-2, for every code in COUNTRY_NAMES. */
const COUNTRY_DIAL_CODES: Record<string, string> = {
  AF: "93", AL: "355", DZ: "213", AO: "244", AR: "54", AM: "374", AU: "61", AT: "43",
  AZ: "994", BH: "973", BD: "880", BY: "375", BE: "32", BJ: "229", BT: "975", BO: "591",
  BA: "387", BW: "267", BR: "55", BN: "673", BG: "359", BF: "226", BI: "257", KH: "855",
  CM: "237", CA: "1", CV: "238", CF: "236", TD: "235", CL: "56", CN: "86", CO: "57",
  KM: "269", CG: "242", CD: "243", CR: "506", CI: "225", HR: "385", CU: "53", CY: "357",
  CZ: "420", DK: "45", DJ: "253", DO: "1", EC: "593", EG: "20", SV: "503", GQ: "240",
  ER: "291", EE: "372", SZ: "268", ET: "251", FJ: "679", FI: "358", FR: "33", GA: "241",
  GM: "220", GE: "995", DE: "49", GH: "233", GR: "30", GT: "502", GN: "224", GW: "245",
  GY: "592", HT: "509", HN: "504", HK: "852", HU: "36", IS: "354", IN: "91", ID: "62",
  IR: "98", IQ: "964", IE: "353", IL: "972", IT: "39", JM: "1", JP: "81", JO: "962",
  KZ: "7", KE: "254", KW: "965", KG: "996", LA: "856", LV: "371", LB: "961", LS: "266",
  LR: "231", LY: "218", LT: "370", LU: "352", MG: "261", MW: "265", MY: "60", MV: "960",
  ML: "223", MT: "356", MR: "222", MU: "230", MX: "52", MD: "373", MN: "976", ME: "382",
  MA: "212", MZ: "258", MM: "95", NA: "264", NP: "977", NL: "31", NZ: "64", NI: "505",
  NE: "227", NG: "234", MK: "389", NO: "47", OM: "968", PK: "92", PS: "970", PA: "507",
  PG: "675", PY: "595", PE: "51", PH: "63", PL: "48", PT: "351", QA: "974", RO: "40",
  RU: "7", RW: "250", SA: "966", SN: "221", RS: "381", SC: "248", SL: "232", SG: "65",
  SK: "421", SI: "386", SO: "252", ZA: "27", KR: "82", SS: "211", ES: "34", LK: "94",
  SD: "249", SR: "597", SE: "46", CH: "41", SY: "963", TW: "886", TJ: "992", TZ: "255",
  TH: "66", TL: "670", TG: "228", TN: "216", TR: "90", TM: "993", UG: "256", UA: "380",
  AE: "971", GB: "44", US: "1", UY: "598", UZ: "998", VE: "58", VN: "84", YE: "967",
  ZM: "260", ZW: "263",
};

/** "+<calling code>" for a country, e.g. countryDialCode("SO") -> "+252". */
export function countryDialCode(code: string) {
  const cc = code.toUpperCase();
  return `+${COUNTRY_DIAL_CODES[cc] ?? "1"}`;
}
