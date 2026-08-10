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
    detail:
      "Scout Travel Solution Limited was incorporated under the Companies Act, 2015 as a private limited company.",
    reference: "Incorporated 22 June 2022",
  },
  {
    key: "kenya-registry",
    label: "Company Registry Record",
    issuer: "Registrar of Companies, Republic of Kenya",
    detail:
      "Nominal share capital KES 100,000, divided into 100 ordinary shares of KES 1,000 each, on file with the Registrar of Companies.",
    reference: "PVT-27USBRL7",
  },
  {
    key: "iata-tids",
    label: "IATA TIDS Accreditation",
    issuer: "International Air Transport Association",
    detail:
      "Certificate of Assignment recognising that the Mogadishu office meets IATA's professional standards for booking services offered to the travel industry.",
  },
  {
    key: "iso-9001",
    label: "ISO 9001:2015 Certified",
    issuer: "TQC Cert",
    detail:
      "Our quality management system has been independently assessed as compliant with ISO 9001:2015, covering the full scope of services we sell.",
    reference: "Certificate TQC-25-1-1428",
    verify: true,
  },
  {
    key: "somalia-licence",
    label: "Commercial Licence",
    issuer: "Ministry of Commerce and Industry, Federal Republic of Somalia",
    detail:
      "Service licence issued to Scout Travel Solution Limited for Hajj and Umrah business activities.",
    reference: "Licence 030170",
    validity: "Issued 1 Apr 2025 · valid to 2 Apr 2026",
  },
  {
    key: "satta",
    label: "SATTA Member",
    issuer: "Somali Association of Travel and Tourism Agents",
    detail:
      "Active member of Somalia's national travel and tourism agents' association.",
    validity: "Active to December 2026",
  },
  {
    key: "kata",
    label: "KATA Member",
    issuer: "Kenya Association of Travel Agents",
    detail: "Member of the Kenya Association of Travel Agents.",
    reference: "KATA/13000B/2025",
    validity: "Valid for 2026",
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
  image: string;
  alt: string;
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
    image: "/about/office-building.webp",
    alt: "Sultan Business Park, the Mogadishu head office building",
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
    image: "/about/storefront.webp",
    alt: "Scout Travel Solution branded reception and entrance",
  },
];

/** Drawn from the company's own wall copy: "We Plan. You Explore. We Care." */
export const PRINCIPLES = [
  {
    title: "Licensed before we sell",
    body: "Hajj and Umrah are licensed activities in Somalia. We hold the Ministry of Commerce and Industry licence for them, and we don't sell what we aren't cleared to sell.",
  },
  {
    title: "Audited, not asserted",
    body: "Our quality management system is certified to ISO 9001:2015 by an independent body — covering ticketing, pilgrimage, hotels, insurance and recruitment alike.",
  },
  {
    title: "Two countries, one company",
    body: "Incorporated in Kenya and licensed in Somalia, so a booking made in Mogadishu is backed by a registered company with a traceable legal identity.",
  },
  {
    title: "Accountable to our industry",
    body: "Membership of SATTA in Somalia and KATA in Kenya means our conduct answers to the national travel-agent bodies in both markets.",
  },
  {
    title: "We plan, you explore",
    body: "Visas, flights, hotels and transport are arranged before you travel, so the itinerary you're handed is one that has already been checked end to end.",
  },
  {
    title: "We care after departure",
    body: "Our guides travel with pilgrim groups, and the Mogadishu desk stays reachable while you're away — not only while you're paying.",
  },
];
