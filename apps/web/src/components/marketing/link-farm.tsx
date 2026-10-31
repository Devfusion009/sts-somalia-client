import Link from "next/link";

import { FOOTER_GROUPS } from "@/lib/marketing-nav";

import { ArrowUpRight, Building2, Globe2, MapPin, Plane, ShieldCheck } from "lucide-react";

const GROUP_ICONS = [Globe2, Building2, MapPin, Plane];
/** Homepage destination directory and payment notice. */
export function LinkFarm() {
  return (
    <section className="border-t border-border bg-muted/30 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_GROUPS.map((group, index) => {
            const Icon = GROUP_ICONS[index % GROUP_ICONS.length];
            return (
              <nav key={group.heading} aria-label={group.heading}>
                <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary"><Icon className="size-4" aria-hidden /></span>
                  <h2 className="font-heading text-base font-semibold">{group.heading}</h2>
                </div>
                <ul className="space-y-0.5">
                  {group.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link href={link.href} className="group flex min-h-9 items-center justify-between gap-2 rounded-md py-1.5 text-sm leading-5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {link.label}<ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-brand-accent/20 bg-card p-5 sm:flex-row sm:gap-5 sm:p-7">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-accent/10 text-brand-accent"><ShieldCheck className="size-6" strokeWidth={1.5} aria-hidden /></span>
          <div>
            <h2 className="font-heading text-base font-semibold">Payment safety notice</h2>
            <p className="mt-2 max-w-5xl text-sm leading-6 text-muted-foreground">
              Scout Travel Solution only collects payment through this website and at our Mogadishu office.
              We never ask for payment via any other website, personal account or payment link, and STS
              accepts no responsibility for losses from payments made outside these channels. If in doubt,
              call{" "}
              <a href="tel:+252611444420" className="font-semibold whitespace-nowrap text-brand-accent hover:underline">
                +252 611 444 420
              </a>{" "}
              before you pay.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
