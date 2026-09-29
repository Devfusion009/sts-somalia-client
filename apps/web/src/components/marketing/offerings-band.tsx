import { FadeIn, StaggerGroup, StaggerItem } from "@/components/ui/aceternity/motion-primitives";
import {
  ConnectIcon,
  FlexibleIcon,
  GiftIcon,
  NoFeesIcon,
  SupportIcon,
  VaultIcon,
} from "@/components/marketing/offering-icons";

/**
 * "Get more with STS" — six offerings in a row of cards, each with a bold
 * duotone line icon on a soft colour-tile that draws itself on as the row
 * scrolls into view.
 *
 * Card copy is split into a neutral `title` and an accent `detail` so the two
 * halves can carry different colour, matching the reference layout's
 * dark-line-then-accent-line rhythm.
 */
const OFFERINGS = [
  {
    Icon: GiftIcon,
    title: "STS Rewards",
    detail: "on every reservation",
  },
  {
    Icon: VaultIcon,
    title: "Secure Wallet",
    detail: "for digital payments",
  },
  {
    Icon: FlexibleIcon,
    title: "Flexible",
    detail: "cancellation policy",
  },
  {
    Icon: NoFeesIcon,
    title: "Zero payment",
    detail: "gateway charges*",
  },
  {
    Icon: SupportIcon,
    title: "24×7 service",
    detail: "support in Somali",
  },
  {
    Icon: ConnectIcon,
    title: "Agent & API",
    detail: "connectivity",
  },
];

export function OfferingsBand() {
  return (
    <section className="bg-muted/40 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Get more with STS Somalia
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Every booking comes with more than a ticket — a rewarding journey for travellers and
            partners alike.
          </p>
        </FadeIn>

        <StaggerGroup
          stagger={0.09}
          className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6"
        >
          {OFFERINGS.map(({ Icon, title, detail }, i) => (
            <StaggerItem key={title} className="grid">
              {/* justify-start (not center): the accent line wraps to one or two
                  lines depending on the card, and centring each card's block
                  independently would land the six icons at different heights.
                  Top-aligning pins every icon to the same baseline across the
                  row, which is what makes it read as a set. */}
              <article className="group flex h-full flex-col items-center justify-start rounded-2xl border border-border/60 bg-card px-4 pt-9 pb-9 text-center shadow-[0_4px_18px_-6px_rgba(16,49,44,0.18)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-primary/25 hover:shadow-[0_18px_38px_-12px_rgba(16,49,44,0.28)]">
                {/* Soft colour-glow tile behind each icon: gives the line-art
                    real presence instead of floating bare on the card, while
                    keeping the icon itself on a flat --card fill so the
                    Knockout shapes inside each icon still match exactly. */}
                <span className="relative flex size-20 shrink-0 items-center justify-center transition-transform duration-300 ease-out group-hover:scale-110 sm:size-22">
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-accent/15 via-primary/10 to-primary/15 blur-[2px]"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-[5px] rounded-full bg-card ring-1 ring-border/70"
                  />
                  <span className="relative size-11 sm:size-12">
                    {/* Stagger the draw-on across the row so the icons write
                        themselves left to right rather than all at once. */}
                    <Icon delay={i * 0.08} />
                  </span>
                </span>

                <h3 className="mt-7 font-heading text-sm leading-snug font-bold text-foreground sm:text-base">
                  {title}
                </h3>
                <p className="mt-1 text-sm leading-snug font-semibold text-balance text-brand-accent sm:text-base">
                  {detail}
                </p>
              </article>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <FadeIn delay={0.15}>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            * No gateway fee on EVC Plus and bank transfers. Card payments carry the processing fee
            charged by the provider.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
