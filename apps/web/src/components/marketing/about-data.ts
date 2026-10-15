/**
 * Company facts for the About page.
 *
 * EVERY entry below is transcribed from the credential photographs supplied by
 * the client (the framed certificate wall, the Somalia commercial licence and
 * the Kenya registry record). Nothing here is invented or rounded up — an
 * About page that overstates an accreditation is a legal problem, not a
 * copywriting one. If a figure isn't on a document, it isn't on this page.
 *
 * Serial numbers that were only partly legible in the source photos are marked
 * with `verify: true` so they can be checked against the paper originals
 * before this page goes live.
 */

export type Credential = {
  key: string;
  label: string;
  issuer: string;
  detail: string;
  /** Reference number exactly as printed, where legible. */
  reference?: string;
  validity?: string;
  /** True when the reference could not be read with full confidence. */
  verify?: boolean;
};

export const CREDENTIALS: Credential[] = [
  {
    key: "kenya-incorporation",
    label: "Certificate of Incorporation",
    issuer: "Registrar of Companies, Republic of Kenya",
    detail: "Private limited company under the Companies Act, 2015.",
    reference: "Incorporated 22 June 2022",
  },
  {
    key: "kenya-registry",
    label: "Company Registry Record",
    issuer: "Registrar of Companies, Republic of Kenya",
    detail: "Share capital KES 100,000 in 100 ordinary shares of KES 1,000.",
    reference: "PVT-27USBRL7",
  },
  {
    key: "iata-tids",
    label: "IATA TIDS Accreditation",
    issuer: "International Air Transport Association",
    detail: "Certificate of Assignment for the Mogadishu office.",
  },
  {
    key: "iso-9001",
    label: "ISO 9001:2015 Certified",
    issuer: "TQC Cert",
    detail: "Quality management system certified across eight service lines.",
    reference: "Certificate TQC-25-1-1428",
    verify: true,
  },
  {
    key: "somalia-licence",
    label: "Commercial Licence",
    issuer: "Ministry of Commerce and Industry, Federal Republic of Somalia",
    detail: "Service licence for Hajj and Umrah business activities.",
    reference: "Licence 030170",
    validity: "Issued 1 April 2025",
  },
  {
    key: "satta",
    label: "SATTA Member",
    issuer: "Somali Association of Travel and Tourism Agents",
    detail: "Active member.",
    validity: "Active to December 2026",
  },
  {
    key: "kata",
    label: "KATA Member",
    issuer: "Kenya Association of Travel Agents",
    detail: "Member for 2026.",
    reference: "KATA/13000B/2025",
    verify: true,
  },
];

/**
 * The eight service lines named in the ISO 9001:2015 scope. This is the single
 * most useful thing on the certificate wall: it is an independently audited
 * statement of what this company is actually set up to do.
 */
export const ISO_SCOPE = [
  "Visa & ticketing",
  "Hajj & Umrah packages",
  "Hotel booking",
  "Medical tourism",
  "Travel insurance",
  "Transportation & cargo services",
  "International recruitment",
  "Embassy facilitation & consulting",
];

export type Office = {
  key: string;
  city: string;
  country: string;
  role: string;
  legalName: string;
  lines: string[];
  poBox?: string;
  phoneDisplay: string;
  phoneTel: string;
  email: string;
  /** Opens the address in Google Maps. */
  mapsUrl: string;
};

/**
 * The two working offices, exactly as supplied by the company.
 *
 * Note these are the OPERATIONAL addresses. The 2022 Kenyan registry filing
 * records a different registered office (P.O. Box 8481 Eastleigh) and an older
 * telephone number — normal for a company that has since moved. The registry
 * card in CREDENTIALS therefore no longer repeats an address, so the page has
 * exactly one source of truth for where to find STS.
 */
export const OFFICES: Office[] = [
  {
    key: "mogadishu",
    city: "Mogadishu",
    country: "Somalia",
    role: "Head office",
    legalName: "Scout Travel Solution Ltd",
    lines: ["First Floor 111, Sultan Business Park", "Waaberi District"],
    phoneDisplay: "+252 611 444 420",
    phoneTel: "tel:+252611444420",
    email: "info@scoutsts.com",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sultan+Business+Park+Waaberi+Mogadishu",
  },
  {
    key: "nairobi",
    city: "Nairobi",
    country: "Kenya",
    role: "Kenya office",
    legalName: "Scout Travel Solution Ltd (STS)",
    lines: ["Yare Plaza, 3rd Floor, Office 308", "Eastleigh, Mohamed Yusuf Haji Avenue"],
    poBox: "P.O. Box 006101004",
    phoneDisplay: "+254 711 620 420",
    phoneTel: "tel:+254711620420",
    email: "info@scoutsts.com",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Yare+Plaza+Eastleigh+Nairobi",
  },
];

/** Drawn from the company's own wall copy: "We Plan. You Explore. We Care." */
export const PRINCIPLES = [
  {
    title: "Licensed before we sell",
    body: "Hajj and Umrah are licensed activities in Somalia. We sell them under the Ministry of Commerce and Industry licence and nothing we aren't cleared to sell.",
  },
  {
    title: "Checked before you travel",
    body: "Visas, flights, hotels and transport are arranged ahead of departure, so the itinerary you receive has been checked end to end.",
  },
  {
    title: "Reachable while you travel",
    body: "Our guides travel with pilgrim groups and the Mogadishu desk stays on the phone for the length of your trip.",
  },
  {
    title: "Answerable in two markets",
    body: "Incorporated in Kenya, licensed in Somalia, and a member of both national travel-agent associations: SATTA and KATA.",
  },
];

/** What a customer can book. Each line links to its own section of the site. */
export const SERVICES = [
  { key: "flights", title: "Flights", body: "Fares from hundreds of airlines, ticketed by an IATA TIDS-accredited desk.", href: "/flights" },
  { key: "hotels", title: "Hotels", body: "Partner hotels across Somalia and East Africa, confirmed before you pay.", href: "/hotels" },
  { key: "visa", title: "Visas", body: "Applications handled case by case, with document checks and status updates.", href: "/visa" },
  { key: "umrah", title: "Hajj & Umrah", body: "Group and private packages under our Ministry of Commerce licence.", href: "/umrah" },
  { key: "events", title: "Events & Halls", body: "Halls and venues across Somalia, booked with a confirmed price.", href: "/events" },
  { key: "partners", title: "Partner programmes", body: "Agencies, hotels, venues and affiliates work with STS on partner terms.", href: "/partners" },
] as const;
