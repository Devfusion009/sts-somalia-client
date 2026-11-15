import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Headphones, Plane } from "lucide-react";
import { SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";

export function FlightBookingPoster() {
  return (
    <section aria-labelledby="flight-desk-poster" className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 sm:pb-10 lg:px-8">
      <div className="relative isolate overflow-hidden rounded-[1.25rem] bg-[#073c34] text-white shadow-[0_16px_45px_-25px_rgba(7,60,52,0.4)]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-20 h-[290px] sm:h-[340px] lg:inset-0 lg:h-full" aria-hidden="true">
          <Image src="/marketing/sts-flight-campaign-v1.webp" alt="" fill sizes="(min-width: 1280px) 1216px, 100vw" className="object-cover object-[65%_50%] lg:object-center" />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-[#073c34] from-35% via-[#073c34]/15 via-65% to-transparent lg:bg-linear-to-r lg:from-[#073c34] lg:from-10% lg:via-[#073c34]/85 lg:via-35% lg:to-transparent lg:to-65%" aria-hidden="true" />
        <div className="px-6 pt-8 pb-[240px] sm:px-10 sm:pt-10 sm:pb-[290px] lg:min-h-[410px] lg:px-12 lg:py-12">
          <div className="max-w-[460px]">
            <span className="inline-flex items-center gap-2.5 text-[9px] font-semibold tracking-[0.22em] text-[#c5ded2] uppercase sm:text-[10px]"><Plane className="size-4 text-[#f4ac76]" aria-hidden="true" /> Domestic & international flights</span>
            <h2 id="flight-desk-poster" className="mt-5 font-heading text-[2.1rem] leading-[1.08] font-medium tracking-[-0.035em] sm:text-[2.75rem] lg:text-[3.1rem]">Your next departure.<br /><span className="text-[#b0d4bc]">Our local expertise.</span></h2>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4">
              <Link href="#flight-search" className="inline-flex min-h-12 items-center justify-center gap-4 rounded-lg bg-[#fb7416] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#df5c08] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Find your flight <ArrowRight className="size-4" aria-hidden="true" /></Link>
              <a href={SUPPORT_PHONE_TEL} className="inline-flex min-h-11 items-center gap-2 rounded-sm text-xs font-medium text-white underline decoration-white/40 underline-offset-4 hover:text-[#b8dfc8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><Headphones className="size-4 text-[#b0d4bc]" aria-hidden="true" /> Talk to our team</a>
            </div>
            <div className="mt-7 flex items-center gap-3 text-[10px] tracking-wide text-[#c5ded2]"><span className="h-px w-6 bg-[#dfa776]" aria-hidden="true" /> Mogadishu · Nairobi <span className="h-3 w-px bg-white/25" aria-hidden="true" /> Support in Somali</div>
          </div>
        </div>
      </div>
    </section>
  );
}
