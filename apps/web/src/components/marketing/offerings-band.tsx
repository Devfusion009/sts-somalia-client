import { BadgePercent, CalendarClock, Headset, Network, UsersRound, Wallet, type LucideIcon } from "lucide-react";

import { FadeIn, StaggerGroup, StaggerItem } from "@/components/ui/aceternity/motion-primitives";

/**
 * "Get more with STS" — six offerings in one ruled panel. A single teal icon
 * tile per item and hairline dividers (the grid gap shows the border colour
 * through) keep it reading as a set, not six separate cards.
 */
const OFFERINGS: Array<{ Icon: LucideIcon; title: string; detail: string }> = [
  { Icon: UsersRound, title: "Saved travellers", detail: "for faster checkout" },
  { Icon: Wallet, title: "Saved wallets", detail: "EVC Plus and card" },
  { Icon: CalendarClock, title: "Flexible", detail: "cancellation policy" },
  { Icon: BadgePercent, title: "Zero payment", detail: "gateway charges*" },
  { Icon: Headset, title: "Somali-speaking", detail: "support desk" },
  { Icon: Network, title: "Agent & API", detail: "connectivity" },
];

export function OfferingsBand() {
  return (
    <section className="bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Get more with STS Somalia
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            One account for every booking, with support in Somali.
          </p>
        </FadeIn>

        <StaggerGroup
          stagger={0.07}
          className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm sm:grid-cols-3 lg:grid-cols-6"
        >
          {OFFERINGS.map(({ Icon, title, detail }) => (
            <StaggerItem key={title} className="grid bg-card">
              <article className="group flex h-full flex-col p-6 transition-colors duration-200 hover:bg-secondary/60">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 ring-inset transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" strokeWidth={1.9} />
                </span>
                <h3 className="mt-5 font-heading text-[15px] leading-snug font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{detail}</p>
              </article>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <FadeIn delay={0.1}>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            * No gateway fee on EVC Plus and bank transfers. Card payments carry the processing fee
            charged by the provider.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
