import Link from "next/link";
import { ExpandMoreIcon } from "@/components/ui/mui-icons";
import { FadeIn } from "@/components/ui/aceternity/motion-primitives";
import { cn } from "@/lib/utils";

/**
 * The two accordion blocks that close the reference page: a route directory
 * ("Flight deals by destination") and an FAQ. Both use native
 * <details>/<summary> — keyboard accessible with zero JS, and the whole block
 * stays a Server Component.
 */

export type DealGroup = { city: string; routes: Array<{ label: string; href: string }> };

export function DealsByDestination({ groups }: { groups: DealGroup[] }) {
  return (
    <section className="bg-sidebar py-12 text-sidebar-foreground sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center">
          <h2 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
            Flight deals by destination
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-sidebar-foreground/70">
            Live fares from the airlines that serve Somalia, issued by our ticketing desk.
          </p>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-9 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <details key={group.city} className="group border-b border-white/15">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium text-sidebar-foreground marker:hidden focus-visible:rounded focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {group.city} flights
                <ExpandMoreIcon
                  sx={{ fontSize: 20 }}
                  className="shrink-0 text-sidebar-foreground/60 transition-transform duration-300 group-open:rotate-180"
                />
              </summary>
              <ul className="pb-4">
                {group.routes.map((route) => (
                  <li key={route.href + route.label}>
                    <Link
                      href={route.href}
                      className="block rounded-sm py-2 text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-primary focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
                    >
                      {route.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </FadeIn>
      </div>
    </section>
  );
}

export function FlightsFaq({
  faqs,
  className,
}: {
  faqs: Array<{ question: string; answer: string }>;
  className?: string;
}) {
  // Structured data for these questions is emitted by the page.
  return (
    <section className={cn("bg-sidebar pt-4 pb-16 text-sidebar-foreground sm:pb-20", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center">
          <h2 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
            How to find cheap flights with STS
          </h2>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-8 grid gap-x-10 sm:grid-cols-2">
          {faqs.map((faq) => (
            <details key={faq.question} className="group border-b border-white/15">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-sm font-medium text-sidebar-foreground marker:hidden focus-visible:rounded focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ExpandMoreIcon
                  sx={{ fontSize: 20 }}
                  className="shrink-0 text-sidebar-foreground/60 transition-transform duration-300 group-open:rotate-180"
                />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-sidebar-foreground/70">{faq.answer}</p>
            </details>
          ))}
        </FadeIn>
      </div>
    </section>
  );
}
