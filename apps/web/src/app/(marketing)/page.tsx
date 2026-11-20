import { Suspense } from "react";
import type { Metadata } from "next";
import { HomeHero } from "@/components/marketing/home-hero";
import { UspStrip } from "@/components/marketing/usp-strip";
import { OfferingsBand } from "@/components/marketing/offerings-band";
import { WhyUsCards } from "@/components/marketing/why-us-cards";
import { FeaturedHotels, FeaturedHotelsSkeleton } from "@/components/marketing/featured-hotels";
import { FeaturedPackages, FeaturedPackagesSkeleton } from "@/components/marketing/featured-packages";
import { SupportCta } from "@/components/marketing/support-cta";
import { HomeFaq, HOME_FAQS } from "@/components/marketing/home-faq";
import { jsonLdScript } from "@/lib/json-ld";

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

      <HomeHero />
      <UspStrip />
      <OfferingsBand />
      <Suspense fallback={<FeaturedPackagesSkeleton />}>
        <FeaturedPackages />
      </Suspense>
      <Suspense fallback={<FeaturedHotelsSkeleton />}>
        <FeaturedHotels />
      </Suspense>
      <WhyUsCards />
      <SupportCta />
      <HomeFaq homepage />
    </>
  );
}
