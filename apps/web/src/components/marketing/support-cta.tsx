import Image from "next/image";
import { ArrowUpRight, Clock3, Phone } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { CallbackForm } from "@/components/marketing/callback-form";
import { WhatsAppIcon, WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";

const tileClass =
  "group flex min-h-16 items-center gap-3 rounded-2xl bg-white/[0.06] p-3 pr-4 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:outline-none";

export function SupportCta() {
  return (
    <section id="plan" className="scroll-mt-32 bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm lg:grid-cols-2">
        <div className="relative isolate flex flex-col overflow-hidden bg-sidebar p-6 text-white sm:p-10 lg:p-12">
          <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 -z-10 size-[28rem] rounded-full bg-teal-400/10 blur-3xl" />
          <Reveal className="flex flex-1 flex-col">
            <h2 className="max-w-lg font-heading text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]">
              Talk to a real person <span className="text-teal-300">before you book.</span>
            </h2>

            {/* 3:2 source shown at its own ratio on phones and close to it on
                desktop, so faces are never cropped into a thin strip. `sizes`
                matches the rendered column width to keep the photo sharp. */}
            <div className="relative mt-8 aspect-[3/2] overflow-hidden rounded-2xl ring-1 ring-white/10 sm:aspect-[16/9]">
              <Image
                src="/marketing/support-team.webp"
                alt="STS travel consultants at work"
                fill
                sizes="(min-width: 1280px) 560px, (min-width: 1024px) 45vw, 90vw"
                className="object-cover object-[center_30%]"
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-sidebar/40 via-transparent to-transparent" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a href={SUPPORT_PHONE_TEL} className={tileClass}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-300/15 text-teal-300">
                  <Phone className="size-[1.125rem]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-white/60">Call us</span>
                  <span className="block truncate font-heading text-base font-semibold tabular-nums">{SUPPORT_PHONE_DISPLAY}</span>
                </span>
              </a>
              <WhatsAppInlineLink message="Hello STS! I have a question before booking." className={tileClass}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
                  <WhatsAppIcon className="size-[1.125rem]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-white/60">WhatsApp</span>
                  <span className="block font-heading text-base font-semibold">Message us</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-white/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" aria-hidden />
              </WhatsAppInlineLink>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-5 text-sm text-white/70 max-lg:mt-6">
              <Clock3 className="size-4 shrink-0 text-white/50" aria-hidden />
              <span>Saturday–Thursday · 8:00–18:00 EAT</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-white/80 ring-1 ring-white/10">
                <span className="size-1.5 rounded-full bg-teal-300" aria-hidden />
                Emergency support 24/7
              </span>
            </div>
          </Reveal>
        </div>
        <Reveal delay={120} className="flex items-center p-2 sm:p-4 lg:p-6">
          <CallbackForm />
        </Reveal>
      </div>
    </section>
  );
}
