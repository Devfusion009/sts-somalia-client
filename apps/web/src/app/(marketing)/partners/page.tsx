import type { Metadata } from "next";
import { Building2, Globe2, SlidersHorizontal, CalendarCheck, BedDouble } from "lucide-react";
import { ProgramLanding } from "@/components/marketing/program-landing";

export const metadata: Metadata = { title: "List Your Hotel" };

export default function PartnersLandingPage() {
  return (
    <ProgramLanding
      eyebrow="Hotel Partners"
      icon={Building2}
      title="List Your Hotel"
      subtitle="Reach travelers across Somalia and beyond. List your property, manage rooms and availability, and receive bookings directly through STS Somalia."
      ctaLabel="Apply to list your hotel"
      ctaHref="/account/become?program=partner"
      benefits={[
        {
          icon: Globe2,
          title: "Reach more travelers",
          description: "Get discovered by customers browsing hotels across Somalia and the region.",
        },
        {
          icon: SlidersHorizontal,
          title: "You control your listing",
          description: "Manage your hotel details, rooms, pricing, and publish status yourself — no approval needed to update.",
        },
        {
          icon: BedDouble,
          title: "Room-level management",
          description: "Add as many room types as you need, each with its own price, occupancy, and availability.",
        },
        {
          icon: CalendarCheck,
          title: "Manage bookings in one place",
          description: "See every booking across all your properties and confirm or cancel from your dashboard.",
        },
      ]}
      steps={[
        {
          title: "Create an account",
          description: "Sign up with your email — takes less than a minute.",
        },
        {
          title: "Tell us about your property",
          description: "Submit your hotel or business name and a short description.",
        },
        {
          title: "Get approved",
          description: "Our team reviews applications and approves most within a couple of business days.",
        },
        {
          title: "Add your hotel and go live",
          description: "Once approved, add your hotel, its rooms, and publish — you're in full control of what's visible.",
        },
      ]}
      faqNote="After approval, you can list multiple properties under one partner account."
    />
  );
}
