import Image from "next/image";
import { ArrowDown, ArrowUpRight, Compass, FileCheck2, Globe2, Headphones, Plane, ShieldCheck, Wallet } from "lucide-react";

function JourneyMap() {
  return (
    <svg viewBox="0 0 640 430" fill="none" className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
      <g stroke="#8bab95" strokeWidth="0.8" opacity="0.2">
        <ellipse cx="325" cy="210" rx="255" ry="172" />
        <ellipse cx="325" cy="210" rx="170" ry="172" />
        <ellipse cx="325" cy="210" rx="85" ry="172" />
        <path d="M74 210h502M100 137h450M100 283h450M160 75h330M160 345h330" />
      </g>
      <g fill="#9dbba5" fillOpacity="0.16" stroke="#91ae98" strokeOpacity="0.2" strokeLinejoin="round">
        <path d="m113 123 27-24 47-6 25 18 38-4 19 23-16 26-28 4-9 28-25 10-28-29-35-8-15-21Z" />
        <path d="m217 203 29 13 18 34-9 37-19 22-8 32-17-17 1-38-20-32 5-31Z" />
        <path d="m304 123 19-22 30 8 20-15 45 8 20-12 58 25 17 26-24 19-43-4-18 22-33-7-11-22-25 5-25-18-20 2Z" />
        <path d="m314 166 38-8 30 26 12 34-23 21-18 47-18-14-5-38-23-27Z" />
        <path d="m458 267 33-17 32 20 9 29-28 9-37-15Z" />
      </g>
      <path d="M353 249C242 224 235 77 355 92" stroke="#bd9665" strokeWidth="1.5" strokeDasharray="4 7" />
      <circle cx="353" cy="249" r="5" fill="#0b7b65" stroke="#f5f5ed" strokeWidth="3" />
      <circle cx="355" cy="92" r="5" fill="#bd9665" stroke="#f5f5ed" strokeWidth="3" />
    </svg>
  );
}

/** Decorative travel objects, kept independent of eligibility and application status. */
function VisaTravelArtwork() {
  return (
    <div className="pointer-events-none relative mx-auto h-[330px] w-full max-w-[540px] select-none sm:h-[410px] lg:h-[440px]" aria-hidden="true">
      <div className="absolute -inset-x-8 -top-6 bottom-0"><JourneyMap /></div>
      <div className="absolute top-4 right-0 size-[290px] rounded-full border border-[#b9cfc1]/60 sm:size-[370px]" />
      <div className="absolute top-10 right-6 size-[240px] rounded-full border border-dashed border-[#b9cfc1]/70 sm:size-[320px]" />
      <div className="absolute top-5 right-4 h-[260px] w-[68%] rotate-[5deg] rounded-[1.3rem] bg-white p-2 shadow-[0_20px_50px_-20px_rgba(11,58,43,0.3)] sm:h-[325px] sm:p-2.5 lg:right-5 lg:h-[355px]">
        <div className="relative h-full overflow-hidden rounded-[0.85rem]">
          <Image src="/marketing/istanbul.webp" alt="" fill preload sizes="(min-width: 1024px) 370px, (min-width: 640px) 350px, 260px" className="object-cover" />
          <div className="absolute inset-0 bg-linear-to-t from-[#052e27]/80 via-transparent to-transparent" />
          <div className="absolute inset-x-5 bottom-5 flex items-end justify-between text-white"><div><span className="text-[9px] tracking-[0.22em] uppercase">Beyond borders</span><span className="mt-1 block font-heading text-2xl font-medium sm:text-3xl">Istanbul, Türkiye</span></div><ArrowUpRight className="mb-1 size-5" /></div>
        </div>
      </div>
      <div className="absolute bottom-3 left-[20%] w-[64%] -rotate-[7deg] rounded-xl border border-[#e2d8c3] bg-[#fffcf3] px-4 py-3 shadow-[0_12px_28px_-14px_rgba(69,58,28,0.3)] sm:bottom-2 sm:py-4">
        <div className="flex items-center justify-between border-b border-dashed border-[#d8ccb4] pb-2 text-[8px] tracking-[0.18em] text-[#8a795c] uppercase"><span>Across borders</span><Plane className="size-3" /></div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[#214d3e]"><span className="font-heading text-xl font-semibold tracking-tight">MGQ</span><span className="h-px flex-1 border-t border-dashed border-[#c8b993]" /><Globe2 className="size-4 text-[#b58c52]" /><span className="font-heading text-xl font-semibold tracking-tight">WORLD</span></div>
      </div>
      <div className="absolute bottom-10 left-2 flex h-[205px] w-[150px] -rotate-[12deg] flex-col items-center rounded-l-lg rounded-r-2xl border border-[#6f9780] bg-[#0a4035] px-4 py-6 text-[#e3c992] shadow-[12px_18px_28px_-10px_rgba(6,40,29,0.45)] sm:bottom-12 sm:left-3 sm:h-[250px] sm:w-[185px] sm:py-8">
        <div className="absolute inset-2 rounded-r-xl border border-[#d5be87]/25" />
        <span className="text-[9px] tracking-[0.27em] uppercase">STS Travel</span>
        <Globe2 className="my-5 size-16 sm:my-6 sm:size-20" strokeWidth={0.65} />
        <span className="font-heading text-sm tracking-[0.24em] uppercase">Passport</span>
        <span className="mt-3 h-3 w-5 rounded-sm border border-[#d5be87]/60"><span className="mx-auto block h-full w-2 rounded-full border-x border-[#d5be87]/60" /></span>
      </div>
      <div className="absolute right-0 bottom-14 flex items-center gap-3 rounded-xl border border-[#dce5dc] bg-white px-3 py-3 shadow-[0_8px_25px_-12px_rgba(7,60,52,0.25)] sm:-right-1 sm:bottom-20 sm:px-4">
        <span className="grid size-10 place-items-center rounded-full bg-[#edf4ef] text-[#167763]"><ShieldCheck className="size-5" strokeWidth={1.5} /></span>
        <span className="text-xs font-semibold text-[#103e32]">Visa specialists<span className="mt-0.5 block text-[10px] font-normal text-[#677b70]">Mogadishu · Nairobi</span></span>
      </div>
      <div className="absolute top-8 left-3 grid size-12 -rotate-12 place-items-center rounded-full border border-[#c5d5c7] bg-[#f5f5ed]/80 text-[#a58151] sm:top-12 sm:left-7 sm:size-16"><Compass className="size-8 sm:size-10" strokeWidth={0.8} /></div>
      <Plane className="absolute top-0 left-[38%] size-6 rotate-[20deg] text-[#c18b56]" strokeWidth={1.2} />
      <div className="absolute top-[43%] -right-1 hidden size-20 rotate-12 items-center justify-center rounded-full border border-dashed border-[#8eaa95]/50 text-center text-[8px] leading-relaxed tracking-[0.14em] text-[#6e8b76] uppercase sm:flex"><span>Explore<br /><Globe2 className="mx-auto my-1 size-5" strokeWidth={1} />The world</span></div>
    </div>
  );
}

export function VisaHeroBanner({ children, search }: { children: React.ReactNode; search: React.ReactNode }) {
  return (
    <section className="relative isolate border-b border-[#dde5dc] bg-[#f5f5ed] text-[#123e32]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true"><div className="absolute -top-40 -right-56 size-[850px] rounded-full bg-[radial-gradient(circle,#e1eadd_0%,transparent_68%)]" /><div className="absolute inset-0 bg-[radial-gradient(#72947b_0.6px,transparent_0.6px)] bg-size-[22px_22px] opacity-[0.07]" /><svg viewBox="0 0 600 250" fill="none" className="absolute top-3 -left-44 hidden w-[650px] text-[#9bb39f]/20 lg:block"><path d="M0 190C140 20 180 240 310 120S510 10 600 40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 9" /><circle cx="310" cy="120" r="7" stroke="currentColor" /></svg></div>
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
