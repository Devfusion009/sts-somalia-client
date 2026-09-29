"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Long-form editorial content. The tail collapses behind a "Read more"
 * toggle using max-height + overflow — the full text stays in the DOM at all
 * times so crawlers and in-page find still see every word.
 */
export function SeoProse() {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          A full-service travel agency for Somalia — online
        </h2>

        {/* Always-visible intro */}
        <div className="mt-8 space-y-6 leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
          <h3 className="font-heading text-xl font-semibold text-foreground">
            Booking travel from Somalia, without the runaround
          </h3>
          <p>
            For years, arranging a trip out of <strong>Mogadishu or Hargeisa</strong> meant visiting
            an office, calling three contacts, paying in cash and hoping the ticket really existed.
            Scout Travel Solution was built to end that. We are a licensed Somali travel agency that
            put its entire desk — <strong>flights, hotels, visas, Umrah packages and event halls</strong>{" "}
            — online, so you can search live options, see the real price, and book in minutes from
            your phone.
          </p>
          <p>
            Unlike a faceless booking site, every reservation lands with a real team in Mogadishu.
            If a flight changes, an embassy asks for one more paper, or a hotel needs an early
            check-in, someone who knows your booking picks up the phone.
          </p>

          <Image
            src="/marketing/travel-flatlay.webp"
            alt="Trip planning with a map, camera and field notes"
            width={1200}
            height={948}
            sizes="(max-width: 768px) 100vw, 768px"
            className="w-full rounded-2xl ring-1 ring-border"
          />

          <h3 className="font-heading text-xl font-semibold text-foreground">
            Flights from Mogadishu, Hargeisa and beyond
          </h3>
          <p>
            We issue tickets on the airlines Somalis actually fly — Turkish Airlines, Emirates,
            Qatar Airways, Ethiopian Airlines, flydubai, Kenya Airways and regional carriers —
            covering the routes that matter: <strong>Dubai, Istanbul, Jeddah, Nairobi, Cairo,
            Kuala Lumpur</strong> and connections worldwide, alongside domestic hops inside Somalia.
            Because we book these routes daily, we know which fares allow changes, which connections
            are safe, and when a slightly later departure saves you real money.
          </p>
        </div>

        {/* Collapsible tail — always in the DOM */}
        <div
          id={contentId}
          className={cn(
            "relative space-y-6 leading-relaxed text-muted-foreground transition-[max-height] duration-500 ease-out [&_strong]:font-semibold [&_strong]:text-foreground",
            expanded ? "max-h-none" : "max-h-56 overflow-hidden"
          )}
        >
          {!expanded ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-background to-transparent"
              aria-hidden
            />
          ) : null}

          <p className="pt-6">
            Every ticket comes with a digital itinerary and receipt, and our desk monitors schedule
            changes so you hear about them from us first — not at the airport.
          </p>

          <h3 className="font-heading text-xl font-semibold text-foreground">
            Hotels you can actually trust
          </h3>
          <p>
            Hotel photos lie; our partners can&rsquo;t. Properties listed on STS — in{" "}
            <strong>Mogadishu, Hargeisa, Nairobi, Addis Ababa, Dubai, Istanbul and the holy
            cities</strong> — are vetted, with confirmed rates and rooms that match their pictures.
            Business trip, family visit or medical stay in Nairobi: tell us the budget and the
            neighbourhood, and book at the price shown.
          </p>

          <h3 className="font-heading text-xl font-semibold text-foreground">
            Visa assistance that gets approvals
          </h3>
          <p>
            Visa rejections usually come down to paperwork, not eligibility. Our visa desk prepares
            applications for the <strong>UAE, Saudi Arabia, Türkiye, Kenya, Ethiopia, Egypt, Qatar
            and Malaysia</strong>, among others. We confirm the exact requirements for your case,
            check every document before submission, book biometric appointments where needed and
            track the application until the passport is back in your hand.
          </p>

          <Image
            src="/marketing/blue-mosque.webp"
            alt="Mosque domes and minarets under a blue sky in Istanbul"
            width={1200}
            height={1800}
            sizes="(max-width: 768px) 100vw, 768px"
            className="max-h-[420px] w-full rounded-2xl object-cover object-[50%_30%] ring-1 ring-border"
          />

          <h3 className="font-heading text-xl font-semibold text-foreground">
            Umrah with people who have done it hundreds of times
          </h3>
          <p>
            An Umrah journey should be spent in worship, not logistics. Our packages bundle{" "}
            <strong>return flights, visa processing, hotels in Makkah and Madinah, ground
            transport and guided ziyarah</strong> at clear per-pilgrim prices across economy,
            standard and VIP tiers. Groups travel with an experienced guide, and elders and
            first-time pilgrims get the extra hands they need.
          </p>

          <h3 className="font-heading text-xl font-semibold text-foreground">
            Event halls for the moments that matter
          </h3>
          <p>
            The same platform books <strong>wedding halls, conference rooms and celebration
            venues</strong> across Mogadishu — with transparent rates, capacity details and catering
            options, coordinated by people who have run hundreds of events.
          </p>

          <h3 className="font-heading text-xl font-semibold text-foreground">
            Why book with a local agency online?
          </h3>
          <p>
            International booking sites don&rsquo;t take EVC Plus, don&rsquo;t answer WhatsApp and
            don&rsquo;t know what a Somali passport holder needs at the Dubai counter. STS does. You
            get the convenience of online booking with the accountability of a local business —
            <strong> local payment methods, local phone numbers and a desk you can walk into</strong>.
            That combination is why families, businesses and travel agents across the Horn of Africa
            book with us again and again.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="mt-8 h-11 gap-1.5 px-6 font-semibold"
        >
          {expanded ? "Read less" : "Read more"}
          <ChevronDown className={cn("size-4 transition-transform duration-300", expanded && "rotate-180")} aria-hidden />
        </Button>
      </div>
    </section>
  );
}
