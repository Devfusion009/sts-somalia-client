import type { Metadata } from "next";
import Image from "next/image";
import { Landmark, HeartHandshake, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PackageCard } from "@/modules/umrah/components/package-card";
import { getAllPackages } from "@/modules/umrah/queries";

export const metadata: Metadata = { title: "Umrah Packages" };

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Visa, flights & hotels handled end to end" },
  { icon: Users, text: "Experienced Somali-speaking group leaders" },
  { icon: HeartHandshake, text: "Support before, during & after your journey" },
];

export default async function UmrahPage() {
  const packages = await getAllPackages();

  return (
    <div>
      {/* Hero — same construction as VisaHeroBanner and FlightsHero: a filled
          background image under a directional scrim, with the content lifted
          above it on z-10. */}
      <section className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground">
        <Image
          src="/marketing/umrah-hero.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          // Narrow screens crop hard: object-right would frame the blown-out
          // open end of the arcade and put the brightest pixels in the image
          // directly behind the copy. Centre keeps the mid-tone columns there
          // instead, and only wide viewports have room to favour the right.
          className="object-cover object-center lg:object-right"
        />
        {/* The artwork's arcade sits on the right and its left half is already
            deep shadow, so the scrim only has to deepen what is there — heavy
            on the left where the headline sits, clearing towards the arches so
            the photograph is still legible as a photograph.
            The gradient has almost no horizontal room to travel on a phone, so
            it stays strong to the right edge until lg, where the copy column
            ends well before the arches begin. */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/90 to-sidebar/70 lg:via-sidebar/85 lg:to-sidebar/35"
          aria-hidden
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <Badge className="border-transparent bg-primary/20 text-primary-foreground">
              Umrah Packages
            </Badge>
            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Your journey to the <span className="text-brand-accent">Haramain</span>, taken care of
            </h1>
            <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/80">
              Complete Umrah journeys from Somalia — flights, visas, hotels near the Haram, ground
              transport, and guided ziyarat, arranged by a team that has done this hundreds of
              times.
            </p>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {TRUST_POINTS.map((point) => (
                <li
                  key={point.text}
                  className="flex items-center gap-2 text-sm text-sidebar-foreground/80"
                >
                  <point.icon className="size-4 text-primary" /> {point.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold">Choose your package</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Departures from Mogadishu and Hargeisa, from a one-week express trip to the last ten nights of
              Ramadan. Every package includes visa processing and a guide who travels with the group.
            </p>
          </div>
        </div>

        {packages.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        ) : (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Landmark className="size-6" />
            </span>
            <h2 className="font-heading text-lg font-semibold">No packages published yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Check back soon — our team is preparing new Umrah packages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
