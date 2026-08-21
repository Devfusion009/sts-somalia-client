/**
 * Single source of truth for the marketing chrome (pill nav, mega menus,
 * footer link farm). Kept as plain data so both the client nav and the server
 * footer read the same routes — every href below resolves to a real route
 * under src/app/(marketing).
 */

export type MegaLink = { label: string; href: string };

export type MegaSection = {
  key: string;
  label: string;
  href: string;
  /** Named MUI icon, resolved in the nav component (data files stay serialisable). */
  icon: "flight" | "hotel" | "visa" | "umrah" | "events";
  blurb: string;
  columns: Array<{ heading: string; links: MegaLink[] }>;
};

export const MEGA_SECTIONS: MegaSection[] = [
  {
    key: "flights",
    label: "Flights",
    href: "/flights",
    icon: "flight",
    blurb: "Domestic Somali routes and international tickets on trusted airlines.",
    columns: [
      {
        heading: "Popular routes",
        links: [
          { label: "Mogadishu → Dubai", href: "/flights?origin=MGQ&destination=DXB" },
          { label: "Mogadishu → Istanbul", href: "/flights?origin=MGQ&destination=IST" },
          { label: "Mogadishu → Nairobi", href: "/flights?origin=MGQ&destination=NBO" },
          { label: "Mogadishu → Jeddah", href: "/flights?origin=MGQ&destination=JED" },
        ],
      },
      {
        heading: "From Somaliland",
        links: [
          { label: "Hargeisa → Dubai", href: "/flights?origin=HGA&destination=DXB" },
          { label: "Hargeisa → Addis Ababa", href: "/flights?origin=HGA&destination=ADD" },
          { label: "Hargeisa → Jeddah", href: "/flights?origin=HGA&destination=JED" },
          { label: "All flights", href: "/flights" },
        ],
      },
    ],
  },
  {
    key: "hotels",
    label: "Hotels",
    href: "/hotels",
    icon: "hotel",
    blurb: "Vetted stays at home and abroad, at confirmed rates.",
    columns: [
      {
        heading: "In Somalia",
        links: [
          { label: "Hotels in Mogadishu", href: "/hotels?city=Mogadishu" },
          { label: "Hotels in Hargeisa", href: "/hotels?city=Hargeisa" },
          { label: "Hotels in Kismayo", href: "/hotels?city=Kismayo" },
          { label: "Hotels in Bosaso", href: "/hotels?city=Bosaso" },
        ],
      },
      {
        heading: "Abroad",
        links: [
          { label: "Hotels in Dubai", href: "/hotels?city=Dubai" },
          { label: "Hotels in Nairobi", href: "/hotels?city=Nairobi" },
          { label: "Hotels in Istanbul", href: "/hotels?city=Istanbul" },
          { label: "All hotels", href: "/hotels" },
        ],
      },
    ],
  },
  {
    key: "visa",
    label: "Visa",
    href: "/visa",
    icon: "visa",
    blurb: "Applications prepared, checked and tracked to approval.",
    columns: [
      {
        heading: "Most requested",
        links: [
          { label: "UAE visa", href: "/visa?country=UAE" },
          { label: "Saudi Arabia visa", href: "/visa?country=Saudi%20Arabia" },
          { label: "Türkiye visa", href: "/visa?country=Turkey" },
          { label: "Kenya visa", href: "/visa?country=Kenya" },
        ],
      },
      {
        heading: "Also handled",
        links: [
          { label: "Ethiopia visa", href: "/visa?country=Ethiopia" },
          { label: "Egypt visa", href: "/visa?country=Egypt" },
          { label: "Malaysia visa", href: "/visa?country=Malaysia" },
          { label: "All visa services", href: "/visa" },
        ],
      },
    ],
  },
  {
    key: "umrah",
    label: "Umrah",
    href: "/umrah",
    icon: "umrah",
    blurb: "Join a fixed-price group package, or build a private trip on your own dates.",
    // The two flows are the top-level split everywhere Umrah appears, the
    // menu included. This column used to be four "By tier" entries that all
    // pointed at the same /umrah URL — four ways to arrive in the same place,
    // and no way to reach either product directly.
    columns: [
      {
        heading: "Group Umrah",
        links: [
          { label: "All group packages", href: "/umrah/group" },
          { label: "Fixed price per person", href: "/umrah/group" },
        ],
      },
      {
        heading: "Private Umrah",
        links: [
          { label: "Build your own trip", href: "/umrah/private" },
          { label: "Compare both options", href: "/umrah" },
        ],
      },
    ],
  },
  {
    key: "events",
    label: "Events & Halls",
    href: "/events",
    icon: "events",
    blurb: "Weddings, conferences and celebrations across Mogadishu.",
    columns: [
      {
        heading: "Browse",
        links: [
          { label: "All venues", href: "/events" },
          { label: "Wedding halls", href: "/events" },
          { label: "Conference rooms", href: "/events" },
        ],
      },
    ],
  },
];

export const SUPPORT_PHONE_DISPLAY = "+252 611 444 420";
export const SUPPORT_PHONE_TEL = "tel:+252611444420";

/** Footer link farm, mirroring the reference site's dense SEO footer. */
export const FOOTER_GROUPS: Array<{ heading: string; links: MegaLink[] }> = [
  {
    heading: "About STS",
    links: [
      { label: "About us", href: "/about" },
      { label: "Flights", href: "/flights" },
      { label: "Hotels", href: "/hotels" },
      { label: "Visa Services", href: "/visa" },
      { label: "Umrah Packages", href: "/umrah" },
      { label: "Group Umrah", href: "/umrah/group" },
      { label: "Private Umrah", href: "/umrah/private" },
      { label: "Events & Halls", href: "/events" },
      { label: "Become a Travel Agent", href: "/agents" },
      { label: "List Your Hotel", href: "/partners" },
      { label: "List Your Event Hall", href: "/venues" },
      { label: "Affiliate Programme", href: "/affiliates" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Partner Terms", href: "/partner-terms" },
      { label: "My Account", href: "/account" },
      { label: "My Bookings", href: "/account/bookings" },
    ],
  },
  {
    heading: "Hotels by city",
    links: [
      { label: "Mogadishu Hotels", href: "/hotels?city=Mogadishu" },
      { label: "Hargeisa Hotels", href: "/hotels?city=Hargeisa" },
      { label: "Kismayo Hotels", href: "/hotels?city=Kismayo" },
      { label: "Bosaso Hotels", href: "/hotels?city=Bosaso" },
      { label: "Garowe Hotels", href: "/hotels?city=Garowe" },
      { label: "Nairobi Hotels", href: "/hotels?city=Nairobi" },
      { label: "Addis Ababa Hotels", href: "/hotels?city=Addis%20Ababa" },
      { label: "Dubai Hotels", href: "/hotels?city=Dubai" },
      { label: "Istanbul Hotels", href: "/hotels?city=Istanbul" },
      { label: "Jeddah Hotels", href: "/hotels?city=Jeddah" },
      { label: "Cairo Hotels", href: "/hotels?city=Cairo" },
      { label: "Kuala Lumpur Hotels", href: "/hotels?city=Kuala%20Lumpur" },
    ],
  },
  {
    heading: "Visa services",
    links: [
      { label: "UAE Visa", href: "/visa?country=UAE" },
      { label: "Saudi Arabia Visa", href: "/visa?country=Saudi%20Arabia" },
      { label: "Türkiye Visa", href: "/visa?country=Turkey" },
      { label: "Kenya Visa", href: "/visa?country=Kenya" },
      { label: "Ethiopia Visa", href: "/visa?country=Ethiopia" },
      { label: "Egypt Visa", href: "/visa?country=Egypt" },
      { label: "Qatar Visa", href: "/visa?country=Qatar" },
      { label: "Malaysia Visa", href: "/visa?country=Malaysia" },
    ],
  },
  {
    heading: "International flights",
    links: [
      { label: "Mogadishu to Dubai Flights", href: "/flights?origin=MGQ&destination=DXB" },
      { label: "Mogadishu to Istanbul Flights", href: "/flights?origin=MGQ&destination=IST" },
      { label: "Mogadishu to Nairobi Flights", href: "/flights?origin=MGQ&destination=NBO" },
      { label: "Mogadishu to Jeddah Flights", href: "/flights?origin=MGQ&destination=JED" },
      { label: "Mogadishu to Cairo Flights", href: "/flights?origin=MGQ&destination=CAI" },
      { label: "Hargeisa to Dubai Flights", href: "/flights?origin=HGA&destination=DXB" },
      { label: "Hargeisa to Addis Ababa Flights", href: "/flights?origin=HGA&destination=ADD" },
      { label: "Mogadishu to Kuala Lumpur Flights", href: "/flights?origin=MGQ&destination=KUL" },
    ],
  },
];
