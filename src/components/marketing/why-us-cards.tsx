

import { FadeIn, SpotlightCard, StaggerGroup, StaggerItem } from "@/components/ui/aceternity/motion-primitives";

import { BeachAccessIcon, Diversity3Icon, HandshakeIcon, SettingsSuggestIcon, ThumbUpAltIcon } from "@/components/ui/mui-icons";
import type { SvgIconComponent } from "@/components/ui/mui-icons";
const PILLARS: Array<{ icon: SvgIconComponent; title: string; body: string }> = [
  {
    icon: HandshakeIcon,
    title: "Trusted advisor",
    body: "A licensed Somali agency with a real office in Mogadishu — not an anonymous booking site you can never reach.",
  },
  {
    icon: ThumbUpAltIcon,
    title: "Responsive",
    body: "Calls and WhatsApp answered by people who know your booking, before you pay and long after you travel.",
  },
  {
    icon: BeachAccessIcon,
    title: "Memorable experiences",
    body: "From Umrah groups to honeymoons and business trips — itineraries built around how your family actually travels.",
  },
  {
    icon: SettingsSuggestIcon,
    title: "Ease",
    body: "Flights, hotels, visas, Umrah and venues behind one account, one invoice and one support number.",
  },
  {
    icon: Diversity3Icon,
    title: "Local & connected",
    body: "Airline, hotel and embassy relationships across the Horn of Africa and the Gulf, working in your favour.",
  },
];

export function WhyUsCards() {
  return (
    <section id="about" className="scroll-mt-32 bg-muted/40 py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center">
          <h2 className="mx-auto max-w-3xl font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl">
            We have served thousands of travellers, and we are here for you
          </h2>
        </FadeIn>

        <StaggerGroup className="mt-11 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {PILLARS.map((pillar) => (
            <StaggerItem key={pillar.title} className="grid">
              <SpotlightCard className="h-full rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl">
                <span className="grid size-14 place-items-center rounded-2xl bg-brand-accent/10 text-brand-accent">
                  <pillar.icon sx={{ fontSize: 30 }} />
                </span>
                <h3 className="mt-5 font-heading text-base font-bold">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
              </SpotlightCard>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
