import Image from "next/image";
import { Headphones, ShieldCheck, Ticket } from "lucide-react";

const TRUST_POINTS = [
  { icon: ShieldCheck, title: "ISO-certified company" },
  { icon: Ticket, title: "Experienced booking team" },
  { icon: Headphones, title: "Support in Somali" },
];

export function FlightsHero({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-secondary/60">
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">From Somalia. To the world.</span>
            <h1 className="mt-5 font-heading text-4xl leading-[1.1] font-bold tracking-[-.04em] sm:text-5xl lg:text-6xl">A new view.<br /><span className="text-primary">A flight away.</span></h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">Domestic and international flights, with support from our ticketing desk.</p>
          </div>
          <div className="relative hidden aspect-[2/1] overflow-hidden rounded-3xl bg-muted sm:block">
            <Image src="/marketing/hero-aircraft.webp" alt="An aircraft wing above the clouds at sunset" fill priority sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" />
          </div>
        </div>
        <div id="flight-search" className="relative mt-10 scroll-mt-24 rounded-2xl border border-border bg-card text-card-foreground shadow-[0_16px_45px_-24px_rgba(30,70,60,0.22)]">{children}</div>
        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 py-7">
          {TRUST_POINTS.map(({ icon: Icon, title }) => <li key={title} className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4 text-primary" aria-hidden />{title}</li>)}
        </ul>
      </div>
    </section>
  );
}
