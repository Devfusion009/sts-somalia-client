import { StaggerGroup, StaggerItem } from "@/components/ui/aceternity/motion-primitives";
import { SectionHeading } from "@/components/marketing/section-heading";

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
    title: "Built around your trip",
    body: "From Umrah groups to honeymoons and business trips — itineraries built around how your family actually travels.",
  },
  {
    icon: SettingsSuggestIcon,
    title: "One account",
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
    <section id="about" className="scroll-mt-32 bg-sidebar py-16 text-sidebar-foreground sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading align="left" tone="dark" title="Why travellers book with STS" />

        <StaggerGroup className="mt-11 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar) => (
            <StaggerItem key={pillar.title} className="flex gap-4">
              <pillar.icon sx={{ fontSize: 28 }} className="shrink-0 text-brand-accent" aria-hidden />
              <div>
                <h3 className="font-heading text-base font-bold">{pillar.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-sidebar-foreground/70">{pillar.body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
