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
            eyebrow="Work with STS"
            title="Grow your business with us"
            lead="Agencies, hotels and promoters across the Horn of Africa earn with STS. Applications are reviewed by a human within two working days."
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {CARDS.map((card, i) => (
            <Reveal key={card.href} delay={i * 80} className="grid">
              <Link
                href={card.href}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <card.icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-heading text-lg font-semibold">{card.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
                <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                  Apply
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
