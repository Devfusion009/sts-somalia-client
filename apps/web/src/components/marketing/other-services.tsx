import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { StaggerGroup, StaggerItem } from "@/components/ui/aceternity/motion-primitives";

const SERVICES: Array<{ title: string; body: string; href: string; cta: string; image: string; span: string }> = [
  {
    title: "Flights",
    body: "Domestic Somali routes and international tickets on Turkish, Emirates, Qatar, Ethiopian, flydubai and more — issued fast, changed by humans, never by a chatbot.",
    href: "/flights",
    cta: "Book a flight",
    image: "/marketing/hero-aircraft.webp",
    span: "lg:col-span-7",
  },
  {
    title: "Hotels",
    body: "A vetted network spanning budget guesthouses to five-star towers, in Mogadishu, Hargeisa, Nairobi, Addis, Dubai, Istanbul and the holy cities. Confirmed rates, real photos.",
    href: "/hotels",
    cta: "Book a hotel",
    image: "/marketing/hotels-panorama.webp",
    span: "lg:col-span-5",
  },
  {
    title: "Umrah",
    body: "Economy, standard and VIP packages bundling return flights, visa processing, hotels in Makkah and Madinah, transport and a guide — one clear price per pilgrim.",
    href: "/umrah",
    cta: "Book Umrah",
    image: "/marketing/umrah-hero.webp",
    span: "lg:col-span-5",
  },
  {
    title: "Events & Halls",
    body: "Wedding halls, conference rooms and celebration venues across Mogadishu, with transparent rates, capacity details, catering options and a coordinator who answers.",
    href: "/events",
    cta: "Book a venue",
    image: "/marketing/events-hero.webp",
    span: "lg:col-span-7",
  },
];

export function OtherServices() {
  return (
    <section className="bg-background py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">Our services</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Four desks, one account, one support team you can actually reach.
        </p>

        <StaggerGroup className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {SERVICES.map((service) => (
            <StaggerItem key={service.title} className={service.span}>
              <Link
                href={service.href}
                className="group relative isolate flex min-h-[280px] flex-col justify-end overflow-hidden rounded-2xl p-7 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Image
                  src={service.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" aria-hidden />
                <div className="relative z-10">
                  <h3 className="font-heading text-2xl font-bold text-white sm:text-3xl">{service.title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/80">{service.body}</p>
                </div>
                <span
                  aria-label={service.cta}
                  className="absolute top-5 right-5 z-10 grid size-11 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur transition-colors duration-300 group-hover:bg-white group-hover:text-neutral-900"
                >
                  <ArrowUpRight className="size-5" aria-hidden />
                </span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
