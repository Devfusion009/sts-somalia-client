import Image from "next/image";
import { ArrowUpRight, Clock3, Phone } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { CallbackForm } from "@/components/marketing/callback-form";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";

export function SupportCta() {
  return (
    <section id="plan" className="scroll-mt-32 bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-border bg-card lg:grid-cols-2">
        <div className="relative isolate overflow-hidden bg-sidebar p-7 text-white sm:p-10 lg:p-12">
          <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 -z-10 size-96 rounded-full border border-white/10" />
          <Reveal>
            <h2 className="max-w-lg font-heading text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]">Talk to a real person <span className="text-teal-300">before you book.</span></h2>
            <div className="relative mt-8 h-40 overflow-hidden rounded-2xl sm:h-48">
              <Image src="/marketing/support-team.webp" alt="" fill sizes="(min-width: 1024px) 480px, 90vw" className="object-cover object-center" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
            <a href={SUPPORT_PHONE_TEL} className="mt-8 flex w-fit items-center gap-3 rounded-lg font-heading text-lg font-semibold tabular-nums transition-colors hover:text-teal-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none sm:text-2xl">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10"><Phone className="size-5" aria-hidden /></span>
              {SUPPORT_PHONE_DISPLAY}
            </a>
            <div className="mt-5 flex items-start gap-3 text-sm leading-6 text-white/75">
              <Clock3 className="mt-1 size-4 shrink-0" aria-hidden />
              <div>Saturday–Thursday · 8:00–18:00 EAT<br /><span className="text-white/55">Emergency support 24/7</span></div>
            </div>
            <WhatsAppInlineLink message="Hello STS! I have a question before booking." className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-lg text-sm font-semibold text-teal-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
              Message us on WhatsApp <ArrowUpRight className="size-4" aria-hidden />
            </WhatsAppInlineLink>
          </Reveal>
        </div>
        <Reveal delay={120} className="flex items-center p-2 sm:p-4 lg:p-6">
          <CallbackForm />
        </Reveal>
      </div>
    </section>
  );
}
