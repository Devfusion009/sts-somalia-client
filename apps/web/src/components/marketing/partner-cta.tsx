import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, HandCoins, Plane, Check, Users, BedDouble, TrendingUp } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";

const CARDS = [
  { href: "/agents", icon: BriefcaseBusiness, detail: Plane, title: "Become a travel agent", label: "Travel agencies", benefit: "B2B rates", action: "Become an agent", tone: "bg-teal-50 text-teal-700", scene: "bg-teal-100/60", secondary: Users },
  { href: "/partners", icon: Building2, detail: BedDouble, title: "List your hotel", label: "Hotel partners", benefit: "Rooms & availability", action: "List your property", tone: "bg-orange-50 text-orange-700", scene: "bg-orange-100/60", secondary: Check },
  { href: "/affiliates", icon: HandCoins, detail: TrendingUp, title: "Join the affiliate programme", label: "Affiliates", benefit: "Booking commissions", action: "Become an affiliate", tone: "bg-sky-50 text-sky-700", scene: "bg-sky-100/60", secondary: Users },
];

export function PartnerCta() {
  return (
    <section className="bg-muted/30 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mb-10 flex items-end justify-between gap-6">
          <h2 className="max-w-xl font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">Grow your business <span className="text-primary">with us.</span></h2>
          <span aria-hidden className="hidden h-px flex-1 bg-border lg:block" />
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {CARDS.map((card, index) => (
            <Reveal key={card.href} delay={index * 80} className="h-full">
              <Link href={card.href} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-3 transition-[box-shadow,border-color] duration-200 hover:border-primary/35 hover:shadow-xl hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4">
                <div aria-hidden className={`relative flex h-44 items-center justify-center overflow-hidden rounded-2xl ${card.tone}`}>
                  <div className={`absolute size-36 rounded-full ${card.scene}`} />
                  <div className="absolute size-48 rounded-full border border-current opacity-10" />
                  <div className="relative -rotate-6 rounded-2xl border border-white/80 bg-white p-5 shadow-lg shadow-black/5 transition-transform duration-300 motion-safe:group-hover:rotate-0">
                    <card.icon className="size-14" strokeWidth={1.4} />
                  </div>
                  <span className="absolute top-7 right-[19%] rotate-12 rounded-xl bg-white p-2.5 shadow-sm"><card.detail className="size-6" strokeWidth={1.5} /></span>
                  <span className="absolute bottom-6 left-[18%] -rotate-12 rounded-xl bg-white p-2.5 shadow-sm"><card.secondary className="size-5" strokeWidth={1.5} /></span>
                </div>
                <div className="flex flex-1 flex-col px-4 pt-6 pb-4 sm:px-5">
                  <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{card.label}</span>
                  <h3 className="mt-3 font-heading text-xl leading-snug font-semibold tracking-tight lg:text-2xl">{card.title}</h3>
                  <span className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Check className="size-4 text-primary" aria-hidden />{card.benefit}</span>
                  <div className="mt-auto pt-7">
                    <span className="flex items-center justify-between gap-3 border-t border-border pt-4 text-sm font-semibold">{card.action}<span className="grid size-9 place-items-center rounded-full bg-primary/8 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><ArrowRight className="size-4" aria-hidden /></span></span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
