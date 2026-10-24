import { Suspense } from "react";
import type { Metadata } from "next";
import { HeroCarousel } from "@/components/marketing/hero-carousel";
import { UspStrip } from "@/components/marketing/usp-strip";
import { OfferingsBand } from "@/components/marketing/offerings-band";
import { RecommendedPackages } from "@/components/marketing/recommended-packages";
import { DestinationRail } from "@/components/marketing/destination-rail";
import { SeasonPicker } from "@/components/marketing/season-picker";
import { OtherServices } from "@/components/marketing/other-services";
import { ReviewsRail } from "@/components/marketing/reviews-rail";
import { WhyUsCards } from "@/components/marketing/why-us-cards";
import { FeaturedHotels, FeaturedHotelsSkeleton } from "@/components/marketing/featured-hotels";
import { FeaturedPackages, FeaturedPackagesSkeleton } from "@/components/marketing/featured-packages";
import { PartnerCta } from "@/components/marketing/partner-cta";
import { SupportCta } from "@/components/marketing/support-cta";
import { HomeFaq, HOME_FAQS } from "@/components/marketing/home-faq";
import { jsonLdScript } from "@/lib/json-ld";
import { LinkFarm } from "@/components/marketing/link-farm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Book Flights, Hotels, Visa & Umrah from Somalia",
  description:
    "Somalia's full-service online travel agency: flights from Mogadishu and Hargeisa, verified hotels, visa assistance, Umrah packages and event halls — backed by a real team you can call.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "STS Somalia",
    title: "STS Somalia — Book Flights, Hotels, Visa & Umrah",
    description:
      "Flights, hotels, visas, Umrah journeys and event halls — planned, booked and backed by a real team in Mogadishu.",
    images: [{ url: "/marketing/slide-gulf-city.webp", width: 2000, height: 838 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "STS Somalia — Book Flights, Hotels, Visa & Umrah",
    description:
      "Flights, hotels, visas, Umrah journeys and event halls — planned, booked and backed by a real team in Mogadishu.",
  },
};

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TravelAgency",
      "@id": `${SITE_URL}/#organization`,
      name: "Scout Travel Solution",
      alternateName: "STS Somalia",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      telephone: "+252611444420",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Sultan Business Park, Waaberi District",
        addressLocality: "Mogadishu",
        addressCountry: "SO",
      },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+252611444420",
        contactType: "customer service",
        availableLanguage: ["so", "en", "ar"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "STS Somalia",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/hotels?city={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

/* Placeholder "from" prices — replace with live fare/rate data at launch. */
const INTERNATIONAL = [
  { title: "Dubai Tour Packages", image: "/marketing/dubai.webp", price: "$620", href: "/hotels?city=Dubai" },
  { title: "Istanbul Tour Packages", image: "/marketing/istanbul.webp", price: "$840", href: "/hotels?city=Istanbul" },
  { title: "Jeddah & Red Sea", image: "/marketing/dest-jeddah.webp", price: "$720", href: "/hotels?city=Jeddah" },
  { title: "Kuala Lumpur Packages", image: "/marketing/dest-kuala-lumpur.webp", price: "$1,140", href: "/hotels?city=Kuala%20Lumpur" },
  { title: "Cairo & Nile Packages", image: "/marketing/dest-cairo.webp", price: "$690", href: "/hotels?city=Cairo" },
  { title: "Umrah Packages", image: "/marketing/madinah.webp", price: "$1,250", href: "/umrah" },
];

const REGIONAL = [
  { title: "Mogadishu Seafront", image: "/marketing/slide-coast.webp", price: "$180", href: "/hotels?city=Mogadishu" },
  { title: "Hargeisa & Somaliland", image: "/marketing/dest-hargeisa.webp", price: "$210", href: "/hotels?city=Hargeisa" },
  { title: "Nairobi Tour Packages", image: "/marketing/kenya.webp", price: "$410", href: "/hotels?city=Nairobi" },
  { title: "Addis Ababa Highlands", image: "/marketing/dest-addis.webp", price: "$390", href: "/hotels?city=Addis%20Ababa" },
  { title: "Kismayo Coast", image: "/marketing/beach.webp", price: "$160", href: "/hotels?city=Kismayo" },
  { title: "Events & Halls", image: "/marketing/events-hall.webp", price: "On request", href: "/events" },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(ORGANIZATION_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: HOME_FAQS.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          }),
        }}
      />

      <HeroCarousel />
      <UspStrip />
      <OfferingsBand />
      <RecommendedPackages />

      <DestinationRail
        className="bg-muted/40"
        title="Trending international destinations"
        blurb="Gulf city breaks, Türkiye and Egypt for shopping and medical trips, Malaysia for study, and Umrah year-round. Every package can be split apart or rebuilt around your dates, your budget and how many of you are travelling."
        cards={INTERNATIONAL}
        viewAll={{ label: "View all packages", href: "/umrah" }}
      />

      <DestinationRail
        title="Trending Somalia and around destinations"
        blurb="Domestic and regional trips are designed for how people here actually move — family visits, business between Mogadishu, Hargeisa and Nairobi, medical travel to Addis and Nairobi, and coastal weekends at home. Short hops, familiar airlines, partner hotels and a support desk in your timezone that answers in Somali."
        cards={REGIONAL}
        viewAll={{ label: "Browse all hotels", href: "/hotels" }}
      />

      <SeasonPicker />

      <Suspense fallback={<FeaturedHotelsSkeleton />}>
        <FeaturedHotels />
      </Suspense>

      <OtherServices />

      <Suspense fallback={<FeaturedPackagesSkeleton />}>
        <FeaturedPackages />
      </Suspense>

      <ReviewsRail />
      <WhyUsCards />
      <PartnerCta />
      <SupportCta />
      <HomeFaq />
      <LinkFarm />
    </>
  );
}
