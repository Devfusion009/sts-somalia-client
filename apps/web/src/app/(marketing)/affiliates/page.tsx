import type { Metadata } from "next";
import { HandCoins, Link2, LineChart, Wallet } from "lucide-react";
import { ProgramLanding } from "@/components/marketing/program-landing";

export const metadata: Metadata = { title: "Join the Affiliate Program" };

export default function AffiliatesLandingPage() {
  return (
    <ProgramLanding
      eyebrow="Affiliate Program"
      icon={HandCoins}
      title="Join the Affiliate Program"
      subtitle="Share your link and earn commission every time someone books a hotel, flight, visa, or Umrah package through STS Somalia."
      ctaLabel="Apply to become an affiliate"
      ctaHref="/account/become?program=affiliate"
      benefits={[
        {
          icon: Link2,
          title: "Your own tracked links",
          description: "Create links to any page — a package, a hotel, or the homepage — and share them anywhere.",
        },
        {
          icon: HandCoins,
          title: "Earn on every booking",
          description: "Get a commission on completed bookings made through your links.",
        },
        {
          icon: LineChart,
          title: "Track performance",
          description: "See clicks, conversions, and earnings for every link from your affiliate dashboard.",
        },
        {
          icon: Wallet,
          title: "Regular payouts",
          description: "Approved commissions are paid out on a regular schedule.",
        },
      ]}
      steps={[
        {
          title: "Create an account",
          description: "Sign up with your email — takes less than a minute.",
        },
        {
          title: "Apply to the program",
          description: "Tell us a little about how you plan to promote STS Somalia.",
        },
        {
          title: "Get your referral code",
          description: "Once approved, you'll get a unique referral code and can create tracked links instantly.",
        },
        {
          title: "Share and earn",
          description: "Promote your links and track clicks, conversions, and commission from your dashboard.",
        },
      ]}
      faqNote="Perfect for content creators, bloggers, and community leaders with an audience interested in travel."
    />
  );
}
