import Link from "next/link";
import { ArrowRight, Briefcase, Building2, HandCoins } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";

const CARDS = [
  {
    href: "/agents",
    icon: Briefcase,
    title: "Become a travel agent",
    description:
      "Get B2B rates, book on behalf of your customers, and manage everything from one dashboard.",
  },
  {
    href: "/partners",
    icon: Building2,
    title: "List your hotel",
    description:
      "List your property, manage rooms and availability, and reach travellers across the region.",
  },
  {
    href: "/affiliates",
    icon: HandCoins,
    title: "Join the affiliate programme",
    description: "Share your link and earn commission on every booking you refer.",
  },
];

export function PartnerCta() {
  return (
    <section className="bg-muted/40 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            title="Grow your business with us"
            lead="Agencies, hotels and promoters across the Horn of Africa earn with STS. Applications are reviewed by a human within two working days."
          />
        </Reveal>
        <Reveal delay={80} className="mt-12 divide-y divide-border rounded-2xl border border-border">
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex items-center gap-5 px-6 py-6 transition-colors duration-200 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:px-8"
            >
              <card.icon className="size-8 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-lg font-semibold">{card.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              </div>
              <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-primary text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowRight className="size-5" aria-hidden />
              </span>
            </Link>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
