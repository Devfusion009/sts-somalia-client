import Image from "next/image";
import { Check, ShieldCheck, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { ExpertCtaButton } from "@/components/marketing/expert-cta-button";

const GROUP_POINTS = ["Each traveller entered once", "Tracked together in your account"];

/**
 * Visa desk card: what STS adds to an application, plus a direct line to
 * the desk on WhatsApp. `wide` lays the copy and the group panel side by
 * side for full-width sections; the default stacks for sidebars.
 */
export function VisaExpertCard({
  visaName,
  wide,
  className,
}: {
  visaName?: string;
  wide?: boolean;
  className?: string;
}) {
  const message = visaName
    ? `Hello STS, I'd like advice on my ${visaName} application.`
    : "Hello STS, I'd like advice on a visa application.";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6",
        wide && "lg:grid lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center lg:gap-10 lg:p-8",
        className,
      )}
    >
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Visa desk · 24/7
        </span>

        <h2
          className={cn(
            "mt-4 font-heading font-bold tracking-tight text-balance",
            wide ? "text-2xl sm:text-3xl" : "text-xl",
          )}
        >
          Document review by our visa desk
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Refused before? Our desk checks every document against what the consulate requires before
          it&apos;s submitted.
        </p>

        {wide ? <DeskActions message={message} className="mt-6 hidden lg:block" /> : null}
      </div>

      <div className={cn("relative mt-5", wide && "lg:mt-0")}>
        <div className="relative flex items-center gap-4 overflow-hidden rounded-xl bg-[linear-gradient(135deg,var(--sidebar)_0%,color-mix(in_oklch,var(--primary),black_35%)_100%)] p-4 text-white shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white/70">Families and groups</p>
            <p className="mt-1 font-heading text-base leading-snug font-bold">One application for everyone</p>
            <ul className="mt-2.5 space-y-1.5">
              {GROUP_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-1.5 text-xs font-medium text-white/90">
                  <Check className="size-3.5 shrink-0 text-white" strokeWidth={2.75} aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative size-24 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15">
            <Image
              src="/marketing/visa-desk.webp"
              alt=""
              fill
              sizes="96px"
              className="object-cover object-[6%_42%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" aria-hidden />
          </div>
        </div>
      </div>

      <DeskActions message={message} className={cn("relative mt-5", wide && "lg:hidden")} />
    </section>
  );
}

function DeskActions({ message, className }: { message: string; className?: string }) {
  return (
    <div className={className}>
      <ExpertCtaButton href={whatsappLink(message)}>Talk to a visa expert</ExpertCtaButton>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden /> Licensed Somali travel agency
        </span>
        <span className="flex items-center gap-1.5">
          <Wallet className="size-3.5 text-primary" aria-hidden /> EVC Plus, bank and card
        </span>
      </div>
    </div>
  );
}
