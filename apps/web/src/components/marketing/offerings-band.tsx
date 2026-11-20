import Link from "next/link";
import { BedDouble, Plane, Stamp, Building2, BookOpen } from "lucide-react";
import { SectionHeading } from "./section-heading";

const SERVICES = [
  { title: "Flights", href: "/flights", Icon: Plane, detail: "Domestic and international routes, with support from our ticketing desk." },
  { title: "Hotels", href: "/hotels", Icon: BedDouble, detail: "Find a stay in Somalia, the region and beyond." },
  { title: "Visa", href: "/visa", Icon: Stamp, detail: "Choose your destination and start your application." },
  { title: "Umrah", href: "/umrah", Icon: BookOpen, detail: "Browse group departures and plan your pilgrimage." },
  { title: "Events & halls", href: "/events", Icon: Building2, detail: "Explore venues for weddings, meetings and celebrations." },
];

export function OfferingsBand() {
  return <section className="py-14 sm:py-20">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeading align="left" title="One team for every part of your trip" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {SERVICES.map(({ title, href, Icon, detail }) => <Link key={href} href={href} className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-secondary/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-5" aria-hidden /></span>
          <h3 className="mt-5 font-heading text-base font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
          <span className="mt-auto pt-5 text-sm font-semibold text-primary">Explore {title.toLowerCase()}</span>
        </Link>)}
      </div>
    </div>
  </section>;
}
