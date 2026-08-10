import type { FlightDeal } from "@/components/marketing/flight-deals-rail";
import type { TrendingEntry } from "@/components/marketing/trending-grid";
import type { DealGroup } from "@/components/marketing/flight-accordions";

/**
 * Static discovery content for the flights page.
 *
 * Fares, durations and dates below are PLACEHOLDERS for layout — wire them to
 * the live fare cache before launch so the page never advertises a price the
 * booking desk can't honour.
 */

export const FLIGHT_DEALS: FlightDeal[] = [
  {
    city: "Dubai",
    image: "/marketing/dubai.webp",
    duration: "4h 20m, direct",
    dates: "Sun 14/9 · Sun 21/9",
    price: "$240",
    href: "/flights?origin=MGQ&destination=DXB",
  },
  {
    city: "Nairobi",
    image: "/marketing/kenya.webp",
    duration: "2h 05m, direct",
    dates: "Sat 13/9 · Sat 20/9",
    price: "$180",
    href: "/flights?origin=MGQ&destination=NBO",
  },
  {
    city: "Addis Ababa",
    image: "/marketing/dest-addis.webp",
    duration: "2h 30m, direct",
    dates: "Tue 16/9 · Tue 23/9",
    price: "$195",
    href: "/flights?origin=MGQ&destination=ADD",
  },
  {
    city: "Jeddah",
    image: "/marketing/dest-jeddah.webp",
    duration: "3h 50m, 1 stop",
    dates: "Fri 12/9 · Fri 19/9",
    price: "$310",
    href: "/flights?origin=MGQ&destination=JED",
  },
  {
    city: "Djibouti",
    image: "/marketing/city-djibouti.webp",
    duration: "1h 15m, direct",
    dates: "Wed 10/9 · Sat 13/9",
    price: "$145",
    href: "/flights?origin=MGQ&destination=JIB",
  },
  {
    city: "Istanbul",
    image: "/marketing/istanbul.webp",
    duration: "7h 40m, 1 stop",
    dates: "Mon 15/9 · Mon 29/9",
    price: "$420",
    href: "/flights?origin=MGQ&destination=IST",
  },
];

export const TRENDING_CITIES: TrendingEntry[] = [
  { name: "Dubai", image: "/marketing/dubai.webp", href: "/flights?origin=MGQ&destination=DXB" },
  { name: "Nairobi", image: "/marketing/kenya.webp", href: "/flights?origin=MGQ&destination=NBO" },
  { name: "Istanbul", image: "/marketing/istanbul.webp", href: "/flights?origin=MGQ&destination=IST" },
  { name: "Addis Ababa", image: "/marketing/dest-addis.webp", href: "/flights?origin=MGQ&destination=ADD" },
  { name: "Jeddah", image: "/marketing/dest-jeddah.webp", href: "/flights?origin=MGQ&destination=JED" },
  { name: "Cairo", image: "/marketing/dest-cairo.webp", href: "/flights?origin=MGQ&destination=CAI" },
  { name: "Doha", image: "/marketing/city-doha.webp", href: "/flights?origin=MGQ&destination=DOH" },
  { name: "Djibouti", image: "/marketing/city-djibouti.webp", href: "/flights?origin=MGQ&destination=JIB" },
  { name: "Kuala Lumpur", image: "/marketing/dest-kuala-lumpur.webp", href: "/flights?origin=MGQ&destination=KUL" },
  { name: "Riyadh", image: "/marketing/city-riyadh.webp", href: "/flights?origin=MGQ&destination=RUH" },
  { name: "Kampala", image: "/marketing/city-kampala.webp", href: "/flights?origin=MGQ&destination=EBB" },
  { name: "Dar es Salaam", image: "/marketing/city-dar-es-salaam.webp", href: "/flights?origin=MGQ&destination=DAR" },
  { name: "Kuwait City", image: "/marketing/city-kuwait.webp", href: "/flights?origin=MGQ&destination=KWI" },
  { name: "Muscat", image: "/marketing/city-muscat.webp", href: "/flights?origin=MGQ&destination=MCT" },
  { name: "London", image: "/marketing/city-london.webp", href: "/flights?origin=MGQ&destination=LHR" },
  { name: "Toronto", image: "/marketing/city-toronto.webp", href: "/flights?origin=MGQ&destination=YYZ" },
  { name: "Stockholm", image: "/marketing/city-stockholm.webp", href: "/flights?origin=MGQ&destination=ARN" },
  { name: "Hargeisa", image: "/marketing/dest-hargeisa.webp", href: "/flights?origin=MGQ&destination=HGA" },
  { name: "Bosaso", image: "/marketing/city-bosaso.webp", href: "/flights?origin=MGQ&destination=BSA" },
  { name: "Kismayo", image: "/marketing/city-kismayo.webp", href: "/flights?origin=MGQ&destination=KMU" },
  { name: "Mogadishu", image: "/marketing/slide-coast.webp", href: "/flights?destination=MGQ" },
];

export const TRENDING_COUNTRIES: TrendingEntry[] = [
  { name: "United Arab Emirates", image: "/marketing/dubai.webp", href: "/flights?origin=MGQ&destination=DXB" },
  { name: "Kenya", image: "/marketing/kenya.webp", href: "/flights?origin=MGQ&destination=NBO" },
  { name: "Türkiye", image: "/marketing/istanbul.webp", href: "/flights?origin=MGQ&destination=IST" },
  { name: "Saudi Arabia", image: "/marketing/city-riyadh.webp", href: "/flights?origin=MGQ&destination=JED" },
  { name: "Ethiopia", image: "/marketing/dest-addis.webp", href: "/flights?origin=MGQ&destination=ADD" },
  { name: "Egypt", image: "/marketing/dest-cairo.webp", href: "/flights?origin=MGQ&destination=CAI" },
  { name: "Qatar", image: "/marketing/city-doha.webp", href: "/flights?origin=MGQ&destination=DOH" },
  { name: "Djibouti", image: "/marketing/city-djibouti.webp", href: "/flights?origin=MGQ&destination=JIB" },
  { name: "Malaysia", image: "/marketing/dest-kuala-lumpur.webp", href: "/flights?origin=MGQ&destination=KUL" },
  { name: "Uganda", image: "/marketing/city-kampala.webp", href: "/flights?origin=MGQ&destination=EBB" },
  { name: "Tanzania", image: "/marketing/city-dar-es-salaam.webp", href: "/flights?origin=MGQ&destination=DAR" },
  { name: "Oman", image: "/marketing/city-muscat.webp", href: "/flights?origin=MGQ&destination=MCT" },
  { name: "Kuwait", image: "/marketing/city-kuwait.webp", href: "/flights?origin=MGQ&destination=KWI" },
  { name: "United Kingdom", image: "/marketing/city-london.webp", href: "/flights?origin=MGQ&destination=LHR" },
  { name: "Canada", image: "/marketing/city-toronto.webp", href: "/flights?origin=MGQ&destination=YYZ" },
  { name: "Sweden", image: "/marketing/city-stockholm.webp", href: "/flights?origin=MGQ&destination=ARN" },
  { name: "Somalia", image: "/marketing/slide-coast.webp", href: "/flights?destination=MGQ" },
  { name: "Somaliland", image: "/marketing/dest-hargeisa.webp", href: "/flights?origin=MGQ&destination=HGA" },
];

const route = (from: string, fromCode: string, to: string, toCode: string) => ({
  label: `${from} to ${to} flights`,
  href: `/flights?origin=${fromCode}&destination=${toCode}`,
});

export const DEAL_GROUPS: DealGroup[] = [
  {
    city: "Mogadishu",
    routes: [
      route("Mogadishu", "MGQ", "Dubai", "DXB"),
      route("Mogadishu", "MGQ", "Nairobi", "NBO"),
      route("Mogadishu", "MGQ", "Istanbul", "IST"),
      route("Mogadishu", "MGQ", "Jeddah", "JED"),
      route("Mogadishu", "MGQ", "Addis Ababa", "ADD"),
    ],
  },
  {
    city: "Hargeisa",
    routes: [
      route("Hargeisa", "HGA", "Dubai", "DXB"),
      route("Hargeisa", "HGA", "Addis Ababa", "ADD"),
      route("Hargeisa", "HGA", "Jeddah", "JED"),
      route("Hargeisa", "HGA", "Nairobi", "NBO"),
    ],
  },
  {
    city: "Dubai",
    routes: [
      route("Dubai", "DXB", "Mogadishu", "MGQ"),
      route("Dubai", "DXB", "Hargeisa", "HGA"),
      route("Dubai", "DXB", "Bosaso", "BSA"),
    ],
  },
  {
    city: "Nairobi",
    routes: [
      route("Nairobi", "NBO", "Mogadishu", "MGQ"),
      route("Nairobi", "NBO", "Kismayo", "KMU"),
      route("Nairobi", "NBO", "Hargeisa", "HGA"),
    ],
  },
  {
    city: "Jeddah",
    routes: [
      route("Jeddah", "JED", "Mogadishu", "MGQ"),
      route("Jeddah", "JED", "Hargeisa", "HGA"),
      route("Jeddah", "JED", "Bosaso", "BSA"),
    ],
  },
  {
    city: "Istanbul",
    routes: [
      route("Istanbul", "IST", "Mogadishu", "MGQ"),
      route("Istanbul", "IST", "Hargeisa", "HGA"),
    ],
  },
  {
    city: "Addis Ababa",
    routes: [
      route("Addis Ababa", "ADD", "Mogadishu", "MGQ"),
      route("Addis Ababa", "ADD", "Hargeisa", "HGA"),
      route("Addis Ababa", "ADD", "Kismayo", "KMU"),
    ],
  },
  {
    city: "Djibouti",
    routes: [
      route("Djibouti", "JIB", "Mogadishu", "MGQ"),
      route("Djibouti", "JIB", "Hargeisa", "HGA"),
    ],
  },
  {
    city: "Doha",
    routes: [route("Doha", "DOH", "Mogadishu", "MGQ"), route("Doha", "DOH", "Hargeisa", "HGA")],
  },
];

export const FLIGHT_FAQS = [
  {
    question: "How does STS find cheap fares?",
    answer:
      "We compare live fares from the airlines that actually serve Somalia and the Horn of Africa, then apply the negotiated agency rates we hold with several of them. Where a published fare beats our contract rate, we book the published fare — the goal is the cheapest workable ticket, not the biggest margin.",
  },
  {
    question: "How do I find the best price on a ticket?",
    answer:
      "Flexibility is worth more than timing tricks. Tell us a range of dates rather than one, and we'll price the whole window. Mid-week departures and early-morning flights are usually cheapest, and booking three to six weeks ahead beats both last-minute and very early booking on most of our routes.",
  },
  {
    question: "Can I hold a fare before paying?",
    answer:
      "On most routes, yes. Our desk can hold a fare for a short window while you arrange payment — ask when you request the booking. Holds are subject to the airline's own rules and aren't available on the very cheapest promotional fares.",
  },
  {
    question: "What if my flight changes or gets cancelled?",
    answer:
      "Because we issue the ticket, we can act on it directly rather than telling you to contact the airline. We monitor schedule changes on tickets we've issued and call you before the airline's automated message reaches you, then rebook you on the best available alternative.",
  },
  {
    question: "Do you book flights for family members abroad?",
    answer:
      "Yes. You can book and pay for a ticket in someone else's name — we just need their passport details exactly as printed. This is one of the most common things our desk does for the diaspora.",
  },
  {
    question: "How do I pay for a ticket?",
    answer:
      "Mobile money (EVC Plus), bank transfer or card. Mobile money and bank transfers carry no gateway fee; card payments carry the processing fee charged by the provider. Every payment gets a receipt and an e-ticket by email and WhatsApp.",
  },
];
