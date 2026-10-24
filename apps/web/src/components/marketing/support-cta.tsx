import Image from "next/image";
import { Clock3, Phone } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { CallbackForm } from "@/components/marketing/callback-form";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";

/** Full-bleed lead-capture band: pitch on the left, callback form on the right. */
export function SupportCta() {
  return (
    <section id="plan" className="relative isolate scroll-mt-32 overflow-hidden bg-sidebar py-16 sm:py-20 lg:py-24">
      <Image
        src="/marketing/support-team.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/80" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_0%_50%,rgba(0,148,124,0.25),transparent)]" aria-hidden />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <Reveal>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl lg:text-5xl">
            Talk to a real person before you book
          </h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-white/85">
            Not sure which fare, which hotel, or whether your documents are enough? Ask first —
            booking online or over the phone costs the same.
          </p>

          <a
            href="tel:+252611444420"
            className="mt-8 inline-flex items-center gap-3 rounded-full font-heading text-2xl font-semibold text-white tabular-nums transition-colors hover:text-teal-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none sm:text-3xl"
          >
            <span className="grid size-12 place-items-center rounded-full bg-white/10 ring-1 ring-white/25">
              <Phone className="size-5" aria-hidden />
            </span>
            +252 611 444 420
          </a>

          <p className="mt-5 flex items-start gap-2 text-sm text-white/70 sm:items-center">
            <Clock3 className="size-4 shrink-0" aria-hidden />
            Saturday–Thursday, 8:00–18:00 EAT · emergencies answered around the clock
          </p>
          <p className="mt-2 text-sm text-white/70">
            Prefer chat?{" "}
            <WhatsAppInlineLink
              message="Hello STS! I have a question before booking."
              className="font-semibold text-teal-300 underline-offset-4 hover:underline"
            >
              Message us on WhatsApp
            </WhatsAppInlineLink>
            .
          </p>
        </Reveal>

        <Reveal delay={120}>
          <CallbackForm />
        </Reveal>
      </div>
    </section>
  );
}
