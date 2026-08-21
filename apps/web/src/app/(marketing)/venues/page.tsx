import type { Metadata } from "next";
import { PartyPopper, Globe2, SlidersHorizontal, CalendarCheck, Banknote } from "lucide-react";
import { ProgramLanding } from "@/components/marketing/program-landing";

export const metadata: Metadata = { title: "List Your Event Hall" };

export default function VenuesLandingPage() {
  return (
    <ProgramLanding
      eyebrow="Venue Partners"
      icon={PartyPopper}
      title="List Your Event Hall"
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
          title: "Booking requests, not surprises",
          description: "Every event is a request you confirm or decline — nothing is booked over your head.",
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
          description: "Sign up with your email — takes less than a minute.",
        },
        {
          title: "Tell us about your venue",
          description: "Capacity, the events you host, and your business documents.",
        },
        {
          title: "Get approved",
          description: "Our team reviews applications and approves most within a couple of business days.",
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
