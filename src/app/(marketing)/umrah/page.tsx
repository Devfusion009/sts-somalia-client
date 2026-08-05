import type { Metadata } from "next";
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
      {/* Hero */}
      <section className="bg-gradient-to-br from-sidebar via-sidebar to-primary/40 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
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
              Three tiers of comfort — every package includes visa processing and dedicated support.
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
