import Link from "next/link";
import { ArrowRight, Briefcase, Building2, HandCoins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const CARDS = [
  {
    href: "/agents",
    icon: Briefcase,
    title: "Travel Agents",
    description: "Get B2B rates, book on behalf of your customers, and manage everything from one dashboard.",
  },
  {
    href: "/partners",
    icon: Building2,
    title: "Hotel Partners",
    description: "List your property, manage rooms and availability, and reach travelers across the region.",
  },
  {
    href: "/affiliates",
    icon: HandCoins,
    title: "Affiliates",
    description: "Share your link and earn commission on every booking you refer.",
  },
];

export function PartnerCta() {
  return (
    <section className="bg-secondary/40 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold">Grow your business with us</h2>
          <p className="mt-2 text-muted-foreground">
            Join STS Somalia as a partner and reach thousands of travelers.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {CARDS.map((card) => (
            <Link key={card.href} href={card.href} className="group">
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <card.icon className="size-5" />
                  </span>
                  <h3 className="font-heading text-lg font-semibold">{card.title}</h3>
                  <p className="flex-1 text-sm text-muted-foreground">{card.description}</p>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary">
                    Get started <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
