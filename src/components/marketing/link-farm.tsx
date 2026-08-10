import Link from "next/link";

import { FOOTER_GROUPS } from "@/lib/marketing-nav";

import { ReportProblemIcon } from "@/components/ui/mui-icons";
/**
 * Dense pipe-separated SEO link block above the footer, plus the fraud-warning
 * notice the reference layout carries. Every href resolves to a real route.
 */
export function LinkFarm() {
  return (
    <section className="border-t border-border bg-background py-12">
      <div className="mx-auto max-w-7xl space-y-7 px-4 sm:px-6 lg:px-8">
        {FOOTER_GROUPS.map((group) => (
          <div key={group.heading}>
            <h2 className="font-heading text-base font-bold">{group.heading}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {group.links.map((link, i) => (
                <span key={link.href + link.label}>
                  <Link href={link.href} className="underline-offset-2 transition-colors hover:text-primary hover:underline">
                    {link.label}
                  </Link>
                  {i < group.links.length - 1 ? <span aria-hidden className="px-2 text-border">|</span> : null}
                </span>
              ))}
            </p>
          </div>
        ))}

        <div className="flex gap-3 rounded-xl border border-brand-accent/25 bg-brand-accent/5 p-5">
          <ReportProblemIcon sx={{ fontSize: 22 }} className="mt-0.5 shrink-0 text-brand-accent" />
          <div>
            <h2 className="font-heading text-base font-bold text-brand-accent">Attention valued customers</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Scout Travel Solution only collects payment through this website and at our Mogadishu office.
              We never ask for payment via any other website, personal account or payment link. Please
              exercise caution before transacting or sharing information anywhere else — STS accepts no
              responsibility for losses arising from payments made outside our official channels. If in
              doubt, call{" "}
              <a href="tel:+252611444420" className="font-semibold text-brand-accent hover:underline">
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
