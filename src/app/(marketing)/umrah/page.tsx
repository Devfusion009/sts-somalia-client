import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { PackageCard } from "@/components/umrah/package-card";
import { getAllPackages } from "@/lib/data/umrah";

export const metadata: Metadata = { title: "Umrah Packages" };

export default async function UmrahPage() {
  const packages = await getAllPackages();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Umrah Packages</h1>
        <p className="mt-3 text-muted-foreground">
          Curated Umrah journeys with flights, hotels in Makkah &amp; Madinah, visa
          processing, and guided ziyarat included.
        </p>
      </div>

      {packages.length > 0 ? (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
  );
}
