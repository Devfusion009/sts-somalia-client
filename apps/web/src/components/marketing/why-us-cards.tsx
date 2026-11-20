import Image from "next/image";
import { Headset, SlidersHorizontal, UserRound } from "lucide-react";
import { SectionHeading } from "./section-heading";

const PILLARS = [
  { Icon: Headset, title: "Responsive", body: "Speak to a team that knows your booking, before and after you travel." },
  { Icon: SlidersHorizontal, title: "Built around your trip", body: "Plan your journey around your dates, your budget and the people travelling with you." },
  { Icon: UserRound, title: "One account", body: "Keep your bookings, applications and receipts together." },
];

export function WhyUsCards() {
  return <section id="about" className="scroll-mt-24 py-14 sm:py-20">
    <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
      <div className="relative aspect-[5/4] overflow-hidden rounded-3xl bg-secondary"><Image src="/auth/sts-reception-v2.webp" alt="STS travel reception" fill sizes="(min-width: 1024px) 45vw, 92vw" className="object-cover" /></div>
      <div>
        <SectionHeading align="left" title="A travel team you can reach" />
        <div className="mt-8 space-y-6">
          {PILLARS.map(({ Icon, title, body }) => <div key={title} className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-5" aria-hidden /></span><div><h3 className="font-heading text-base font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div></div>)}
        </div>
      </div>
    </div>
  </section>;
}
