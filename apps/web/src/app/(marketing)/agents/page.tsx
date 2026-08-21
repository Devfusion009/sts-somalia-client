import type { Metadata } from "next";
import { Briefcase, Percent, Users, Headset, LayoutDashboard } from "lucide-react";
import { ProgramLanding } from "@/components/marketing/program-landing";
import { portalLoginHref } from "@/lib/subdomain";

export const metadata: Metadata = { title: "Become a Travel Agent" };

export default function AgentsLandingPage() {
  // This page is served on the root host, but /agent/login only exists on the
  // agent subdomain once Phase 2 is configured (proxy.ts 404s /agent/* on the
  // root host by design). portalLoginHref handles both modes — and it is the
  // one agent sign-in page, the same one /login's Business tab points at.
  const agentLoginHref = portalLoginHref("agent");

  return (
    <ProgramLanding
      eyebrow="B2B Travel Agents"
      icon={Briefcase}
      title="Become a Travel Agent"
      subtitle="Access B2B rates on hotels, flights, visas, and Umrah packages, and manage every booking for your customers from one dashboard."
      ctaLabel="Apply to become an agent"
      ctaHref="/account/become?program=agent"
      loginHref={agentLoginHref}
      benefits={[
        {
          icon: Percent,
          title: "B2B commission rates",
          description: "Book at negotiated rates and earn commission on every trip you arrange.",
        },
        {
          icon: LayoutDashboard,
          title: "One agent dashboard",
          description: "Track every booking made through your agency in a single, unified view.",
        },
        {
          icon: Users,
          title: "Team accounts",
          description: "Add staff to your agency so your whole team can book under one account.",
        },
        {
          icon: Headset,
          title: "Dedicated support",
          description: "Get priority help from our Mogadishu-based team when you need it.",
        },
      ]}
      steps={[
        {
          title: "Create an account",
          description: "Sign up with your email — takes less than a minute.",
        },
        {
          title: "Submit your agency details",
          description: "Tell us your agency name and a bit about your business.",
        },
        {
          title: "Get approved",
          description: "Our team reviews applications and approves most within a couple of business days.",
        },
        {
          title: "Start booking",
          description: "Browse hotels, flights, visas, and Umrah packages — every booking you make is automatically attributed to your agency.",
        },
      ]}
      faqNote="Once approved, you can invite staff to your agency and see every booking your team makes."
    />
  );
}
