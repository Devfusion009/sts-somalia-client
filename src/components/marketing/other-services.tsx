import Link from "next/link";

import { FadeIn, SpotlightCard, StaggerGroup, StaggerItem } from "@/components/ui/aceternity/motion-primitives";

import { ApartmentIcon, ArrowForwardIcon, CelebrationIcon, FlightTakeoffIcon, MosqueIcon } from "@/components/ui/mui-icons";
import type { SvgIconComponent } from "@/components/ui/mui-icons";
const SERVICES: Array<{ icon: SvgIconComponent; title: string; body: string; href: string; cta: string }> = [
  {
    icon: FlightTakeoffIcon,
    title: "Flights",
    body: "Domestic Somali routes and international tickets on Turkish, Emirates, Qatar, Ethiopian, flydubai and more — issued fast, changed by humans, never by a chatbot.",
    href: "/flights",
    cta: "Book now",
  },
  {
    icon: ApartmentIcon,
    title: "Hotels",
    body: "A vetted network spanning budget guesthouses to five-star towers, in Mogadishu, Hargeisa, Nairobi, Addis, Dubai, Istanbul and the holy cities. Confirmed rates, real photos.",
    href: "/hotels",
    cta: "Book now",
  },
  {
    icon: MosqueIcon,
    title: "Umrah",
    body: "Economy, standard and VIP packages bundling return flights, visa processing, hotels in Makkah and Madinah, transport and a guide — one clear price per pilgrim.",
    href: "/umrah",
    cta: "Book now",
  },
  {
    icon: CelebrationIcon,
    title: "Events & Halls",
    body: "Wedding halls, conference rooms and celebration venues across Mogadishu, with transparent rates, capacity details, catering options and a coordinator who answers.",
    href: "/events",
    cta: "Book now",
  },
];

export function OtherServices() {
  return (
    <section className="bg-background py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">Our services</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Four desks, one account, one support team you can actually reach.
          </p>
        </FadeIn>

        <StaggerGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <StaggerItem key={service.title} className="grid">
              <SpotlightCard className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl">
                <span className="grid size-14 place-items-center rounded-2xl bg-brand-accent/10 text-brand-accent">
                  <service.icon sx={{ fontSize: 30 }} />
                </span>
                <h3 className="mt-5 font-heading text-lg font-bold">{service.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{service.body}</p>
                <Link
                  href={service.href}
                  className="mt-5 inline-flex items-center gap-1 font-heading text-sm font-bold text-brand-accent transition-colors hover:text-brand-accent/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {service.cta}
                  <ArrowForwardIcon sx={{ fontSize: 15 }} />
                </Link>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
