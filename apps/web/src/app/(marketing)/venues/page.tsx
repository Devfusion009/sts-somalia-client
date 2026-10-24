import type { Metadata } from "next";
import { PartyPopper, Globe2, SlidersHorizontal, CalendarCheck, Banknote } from "lucide-react";
import { ProgramLanding } from "@/components/marketing/program-landing";

export const metadata: Metadata = { title: "List your event hall" };

export default function VenuesLandingPage() {
  return (
    <ProgramLanding
      image={{ src: "/marketing/partner-venue.webp", alt: "An event hall set for a wedding, with staff checking the layout" }}
      eyebrow="Venue partners"
      icon={PartyPopper}
      title="List your event hall"
      subtitle="Weddings, conferences, graduations — put your venue in front of customers planning events across Somalia, and handle every booking request from one dashboard."
      ctaLabel="Apply to list your venue"
      ctaHref="/account/become?program=venue"
      benefits={[
        {
          icon: Globe2,
          title: "Reach event planners",
          description: "Get discovered by customers browsing halls on the STS Events & Halls pages.",
        },
        {
          icon: SlidersHorizontal,
          title: "Your venue, your terms",
          description: "Set your capacity, event types, pricing model (per event, day, or hour) and keep them updated.",
        },
        {
          icon: CalendarCheck,
          title: "You confirm every booking",
          description: "Every event is a request you confirm or decline.",
        },
        {
          icon: Banknote,
          title: "Payouts on your schedule",
          description: "Customers pay STS at booking; your share is paid out on the cadence you choose.",
        },
      ]}
      steps={[
        {
          title: "Create an account",
          description: "Sign up with your email.",
        },
        {
          title: "Tell us about your venue",
          description: "Capacity, the events you host, and your business documents.",
        },
        {
          title: "Get approved",
          description: "Our team reviews your application.",
        },
        {
          title: "List your hall and take requests",
          description: "Create your listing in the Venue Portal; once staff publish it, requests arrive in your dashboard.",
        },
      ]}
      faqNote="After approval, you can list multiple halls under one venue partner account."
    />
  );
}
