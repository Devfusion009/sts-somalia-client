import Image from "next/image";
import { ArrowDown, ArrowUpRight, FileCheck2, Globe2, Headphones, Plane, ShieldCheck, Wallet } from "lucide-react";

/** Decorative travel objects, kept independent of eligibility and application status. */
function VisaTravelArtwork() {
  return (
    <div className="relative mx-auto h-[310px] w-full max-w-[540px] sm:h-[370px] lg:h-[405px]" aria-hidden="true">
      <div className="absolute top-4 right-0 size-[290px] rounded-full border border-[#b9cfc1]/60 sm:size-[370px]" />
      <div className="absolute top-10 right-6 size-[240px] rounded-full border border-dashed border-[#b9cfc1]/70 sm:size-[320px]" />
      <div className="absolute top-2 right-4 h-[260px] w-[68%] rotate-[5deg] rounded-[1.3rem] bg-white p-2 shadow-[0_20px_50px_-20px_rgba(11,58,43,0.3)] sm:h-[325px] sm:p-2.5 lg:right-5 lg:h-[355px]">
        <div className="relative h-full overflow-hidden rounded-[0.85rem]">
          <Image src="/marketing/istanbul.webp" alt="" fill preload sizes="(min-width: 1024px) 370px, (min-width: 640px) 350px, 260px" className="object-cover" />
          <div className="absolute inset-0 bg-linear-to-t from-[#052e27]/80 via-transparent to-transparent" />
          <div className="absolute inset-x-5 bottom-5 flex items-end justify-between text-white"><div><span className="text-[9px] tracking-[0.22em] uppercase">Beyond borders</span><span className="mt-1 block font-heading text-2xl font-medium sm:text-3xl">Istanbul, Türkiye</span></div><ArrowUpRight className="mb-1 size-5" /></div>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 flex h-[205px] w-[150px] -rotate-[12deg] flex-col items-center rounded-l-lg rounded-r-2xl border border-[#6f9780] bg-[#0a4035] px-4 py-6 text-[#e3c992] shadow-[12px_18px_28px_-10px_rgba(6,40,29,0.45)] sm:bottom-4 sm:left-5 sm:h-[250px] sm:w-[185px] sm:py-8">
        <div className="absolute inset-2 rounded-r-xl border border-[#d5be87]/25" />
        <span className="text-[9px] tracking-[0.27em] uppercase">STS Travel</span>
        <Globe2 className="my-5 size-16 sm:my-6 sm:size-20" strokeWidth={0.65} />
        <span className="font-heading text-sm tracking-[0.24em] uppercase">Passport</span>
        <span className="mt-3 h-3 w-5 rounded-sm border border-[#d5be87]/60"><span className="mx-auto block h-full w-2 rounded-full border-x border-[#d5be87]/60" /></span>
      </div>
      <div className="absolute right-0 bottom-0 flex items-center gap-3 rounded-xl border border-[#dce5dc] bg-white px-4 py-3 shadow-[0_8px_25px_-12px_rgba(7,60,52,0.25)] sm:right-1 sm:bottom-1">
        <span className="grid size-10 place-items-center rounded-full bg-[#edf4ef] text-[#167763]"><ShieldCheck className="size-5" strokeWidth={1.5} /></span>
        <span className="text-xs font-semibold text-[#103e32]">Visa specialists<span className="mt-0.5 block text-[10px] font-normal text-[#677b70]">Mogadishu · Nairobi</span></span>
      </div>
      <Plane className="absolute top-2 left-8 size-7 -rotate-12 text-[#c18b56] sm:top-5" strokeWidth={1.2} />
    </div>
  );
}

export function VisaHeroBanner({ children, search }: { children: React.ReactNode; search: React.ReactNode }) {
  return (
    <section className="relative isolate border-b border-[#dde5dc] bg-[#f5f5ed] text-[#123e32]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true"><div className="absolute -top-40 -right-56 size-[850px] rounded-full bg-[radial-gradient(circle,#e1eadd_0%,transparent_68%)]" /></div>
      <div className="mx-auto max-w-7xl px-4 pt-10 pb-7 sm:px-6 sm:pt-14 lg:px-8 lg:pt-12">
        <div className="grid items-center gap-6 pb-6 sm:pb-9 lg:grid-cols-[1.08fr_1fr] lg:gap-10">
          <div>{children}</div>
          <VisaTravelArtwork />
        </div>
        <div className="relative z-20 rounded-[1.4rem] border border-[#dce5dc] bg-white p-5 shadow-[0_15px_45px_-25px_rgba(7,60,52,0.25)] sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2.5 font-heading text-lg font-semibold text-[#123e32]"><Globe2 className="size-5 text-primary" strokeWidth={1.5} /> Where are you travelling?</h2><a href="#visa-results" className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-[#547267] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">All destinations <ArrowDown className="size-3.5" aria-hidden="true" /></a></div>
          {search}
        </div>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[11px] font-medium text-[#4e6c60] sm:text-xs lg:gap-x-14">
          {[{ icon: ShieldCheck, label: "ISO-certified company" }, { icon: FileCheck2, label: "Document review" }, { icon: Headphones, label: "Support in Somali" }, { icon: Wallet, label: "Local payment options" }].map(({ icon: Icon, label }) => <li key={label} className="flex items-center gap-2"><Icon className="size-4 text-[#00816c]" strokeWidth={1.5} aria-hidden="true" />{label}</li>)}
        </ul>
      </div>
    </section>
  );
}

export { VisaProcess } from "./visa-visual-sections";
