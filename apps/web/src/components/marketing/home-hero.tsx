import Image from "next/image";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HomeHero() {
  return (
    <section className="bg-secondary/60">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
        <div>
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">Travel with STS Somalia</span>
          <h1 className="mt-5 max-w-xl font-heading text-4xl leading-[1.12] font-bold tracking-[-.045em] sm:text-5xl lg:text-6xl">
            Travel from Somalia,<br /><span className="text-primary">done properly.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">Flights, hotels, visas, Umrah and event halls — with a team in Mogadishu and Nairobi.</p>
          <div className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-[0_12px_40px_-16px_rgba(30,70,60,0.18)] sm:p-5">
            <nav aria-label="Explore travel services" className="mb-5 flex flex-wrap gap-1 border-b border-border pb-3">
              {[["Flights", "/flights"], ["Hotels", "/hotels"], ["Visa", "/visa"], ["Umrah", "/umrah"], ["Events & halls", "/events"]].map(([label, href]) => <Link key={href} href={href} className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{label}</Link>)}
            </nav>
            <form action="/hotels" className="space-y-3" role="search" aria-label="Find a hotel">
              <label htmlFor="home-destination" className="block text-sm font-medium">Where would you like to stay?</label>
              <div className="relative"><MapPin className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-primary" aria-hidden /><Input id="home-destination" name="city" placeholder="City or destination" className="pl-10" /></div>
              <Button type="submit" size="lg" className="w-full rounded-xl bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/85"><Search className="size-4" aria-hidden />Find hotels</Button>
            </form>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="relative aspect-[5/4] overflow-hidden rounded-3xl bg-muted">
            <Image src="/about/umrah-group-wide.webp" alt="STS travellers and their guides on an Umrah journey" fill priority sizes="(min-width: 1024px) 46vw, 92vw" className="object-cover" />
          </div>
          <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm sm:left-6">
            <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><MapPin className="size-5" aria-hidden /></span>
            <div><p className="text-sm font-semibold">Our people. Your journey.</p><p className="mt-0.5 text-xs text-muted-foreground">Umrah with the STS team</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}
