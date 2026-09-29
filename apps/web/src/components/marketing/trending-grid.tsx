import Image from "next/image";
import Link from "next/link";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/ui/aceternity/motion-primitives";

export type TrendingEntry = { name: string; image: string; href: string };

/**
 * "Trending cities / countries" — a dense three-column grid of thin cards, each
 * a thumbnail beside the place name. Carries the page's SEO weight; the
 * "flights to" framing lives once in the section title, not repeated per row.
 */
export function TrendingGrid({
  title,
  subtitle,
  entries,
}: {
  title: string;
  subtitle: string;
  entries: TrendingEntry[];
}) {
  return (
    <section className="bg-sidebar py-12 text-sidebar-foreground sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center">
          <h2 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>
          <p className="mt-1.5 text-sm text-sidebar-foreground/70">{subtitle}</p>
        </FadeIn>

        <StaggerGroup stagger={0.03} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <StaggerItem key={entry.name} className="grid">
              <Link
                href={entry.href}
                className="group flex items-stretch overflow-hidden rounded-lg bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none"
              >
                <span className="relative h-14 w-20 shrink-0 overflow-hidden">
                  <Image
                    src={entry.image}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </span>
                <span className="flex min-w-0 flex-col justify-center px-3 py-2">
                  <span className="truncate font-heading text-base font-bold text-neutral-900 transition-colors group-hover:text-primary">
                    {entry.name}
                  </span>
                </span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
