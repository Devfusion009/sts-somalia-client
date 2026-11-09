import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { VisaIllustration, type VisaScene } from "./visa-illustrations";

type UmrahScene = "group" | "private" | "transport" | "train";
function UmrahIllustration({ scene }: { scene: UmrahScene }) {
  return (
    <svg viewBox="0 0 280 200" fill="none" aria-hidden="true" className="aspect-[7/5] w-full">
      <ellipse cx="140" cy="175" rx="95" ry="9" fill="#acc7af" opacity=".25" />
      <circle cx="140" cy="100" r="73" stroke="#cad9c2" /><circle cx="140" cy="100" r="60" stroke="#dce5d2" />
      {scene === "group" || scene === "private" ? <>
        <path d="m89 68 58-16 54 21-58 17z" fill="#314b3c" /><path d="M89 68v83l54 22V90z" fill="#132e27" /><path d="m143 90 58-17v80l-58 20z" fill="#214a3c" />
        <path d="m89 88 54 22 58-18v13l-58 18-54-22z" fill="#c9a86a" /><path d="M156 129v30l15-5v-30z" fill="#c9a86a" />
        <path d="M61 104V50m-5 0h10m-8-5h6m-3-5v-7" stroke="#9bb99d" strokeWidth="3" strokeLinecap="round" />
        {scene === "group" ? [64,88,112].map((x,i) => <g key={x} transform={`translate(${x} ${143+i*5})`}><circle r="7" fill="#4b8168" /><path d="M-10 23V12a10 10 0 0 1 20 0v11" fill="#f8f6e9" stroke="#91b298" /></g>) : <><path d="M65 153c-17-43 33-102 99-111" stroke="#b3884e" strokeWidth="2" strokeDasharray="4 5" /><circle cx="65" cy="153" r="5" fill="#b3884e" /></>}
      </> : scene === "transport" ? <>
        <rect x="55" y="61" width="172" height="91" rx="16" fill="#f9f9ee" stroke="#9fbea6" /><path d="M55 122h172v15a15 15 0 0 1-15 15H70a15 15 0 0 1-15-15z" fill="#1c6651" />
        {[69,102,135,168].map(x=><rect key={x} x={x} y="75" width="25" height="34" rx="5" fill="#8cbba6" />)}<rect x="202" y="74" width="15" height="48" rx="4" fill="#336d57" />
        {[86,198].map(x=><g key={x}><circle cx={x} cy="151" r="13" fill="#173f32" /><circle cx={x} cy="151" r="6" fill="#b3c9b4" /></g>)}<path d="M73 128h64" stroke="#d2b577" strokeWidth="4" strokeLinecap="round" />
      </> : <>
        <path d="M61 158h156M77 173h124" stroke="#a6bea3" strokeWidth="3" strokeLinecap="round" /><path d="M80 158 69 182m131-24 11 24" stroke="#a6bea3" strokeWidth="3" />
        <rect x="88" y="32" width="104" height="127" rx="30" fill="#faf8eb" stroke="#9bbd9f" /><path d="M88 105h104v25a29 29 0 0 1-29 29h-46a29 29 0 0 1-29-29z" fill="#1b6550" /><rect x="102" y="54" width="76" height="42" rx="12" fill="#75a78f" /><path d="M140 55v40" stroke="#d6e4cc" strokeWidth="2" />
        <path d="M121 43h38" stroke="#b99458" strokeWidth="4" strokeLinecap="round" />{[109,171].map(x=><circle key={x} cx={x} cy="119" r="5" fill="#dfc58b" />)}
      </>}
    </svg>
  );
}

const STEPS: { scene: VisaScene | "group"; title: string }[] = [
  { scene: "group", title: "Choose your package" },
  { scene: "family", title: "Add pilgrim details" },
  { scene: "payment", title: "Deposit or full payment" },
  { scene: "decision", title: "Visa & travel confirmation" },
  { scene: "support", title: "Stay in touch" },
];

export function UmrahBookingJourney() {
  return <section aria-labelledby="umrah-journey" className="bg-[#073c34] py-14 text-white sm:py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-5"><div><span className="text-[10px] tracking-[0.2em] text-[#b7ceba] uppercase">Your journey, thoughtfully arranged</span><h2 id="umrah-journey" className="mt-3 font-heading text-3xl font-medium tracking-tight sm:text-4xl">From intention to departure.</h2></div><Link href="#umrah-compare" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">Choose your journey <ArrowRight className="size-4" aria-hidden /></Link></div><ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{STEPS.map((s,i)=><li key={s.scene} className="min-w-0"><div className="relative overflow-hidden rounded-2xl border border-[#d1dcc6] bg-[#f1f3e6]"><span className="absolute top-3 left-4 text-[10px] font-medium text-[#65816c]">0{i+1}</span>{s.scene==='group' ? <UmrahIllustration scene="group" /> : <VisaIllustration scene={s.scene} className="aspect-[7/5] w-full" />}</div><div className="mt-4 border-t border-[#64856e] pt-4"><h3 className="font-heading text-sm font-medium">{s.title}</h3></div></li>)}</ol></div></section>;
}

const SERVICES: { label: string; category: string; scene: VisaScene | UmrahScene }[] = [
  { label: "Makkah hotel", category: "hotel_makkah", scene: "stay" },
  { label: "Madinah hotel", category: "hotel_madinah", scene: "stay" },
  { label: "Flights", category: "flight", scene: "flight" },
  { label: "Umrah visa", category: "visa", scene: "passport" },
  { label: "Ground transport", category: "transport", scene: "transport" },
  { label: "Makkah ↔ Madinah", category: "intercity", scene: "train" },
  { label: "Extra services", category: "extra", scene: "support" },
];

export function UmrahServiceGallery() {
  return <section aria-labelledby="umrah-services" className="border-b border-border bg-[#f6f6ee] py-14 sm:py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-5"><div><span className="text-[10px] tracking-[0.2em] text-[#6b826e] uppercase">A trip around you</span><h2 id="umrah-services" className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Your private Umrah.<br />Every detail, your choice.</h2></div><Link href="/umrah/private" className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-brand-accent px-6 text-sm font-semibold text-brand-accent-foreground hover:bg-brand-accent/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Start building <ArrowRight className="size-4" aria-hidden /></Link></div><ul className="mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4">{SERVICES.map(s=><li key={s.category}><Link href={`/umrah/private#service-${s.category}`} className="group block h-full overflow-hidden rounded-2xl border border-[#d7e1d2] bg-[#fffef8] transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><div className="bg-[#edf1e3]">{s.scene==='transport'||s.scene==='train' ? <UmrahIllustration scene={s.scene} /> : <VisaIllustration scene={s.scene as VisaScene} className="aspect-[7/5] w-full" />}</div><div className="flex items-center justify-between gap-2 px-4 py-4"><h3 className="font-heading text-sm font-semibold">{s.label}</h3><ArrowUpRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden /></div></Link></li>)}<li className="flex flex-col justify-between rounded-2xl bg-[#123f32] p-6 text-white"><span className="text-[10px] tracking-[0.18em] text-[#c2d5bd] uppercase">Made for your party</span><div><span className="block font-heading text-2xl leading-tight">One trip.<br />Your own pace.</span><Link href="/umrah/private" className="mt-5 inline-flex min-h-10 items-center gap-3 rounded-sm text-sm text-[#e2d3aa] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-white">Build my trip <ArrowRight className="size-4" aria-hidden /></Link></div></li></ul></div></section>;
}

const OPTIONS = [
  { key: "group" as const, title: "Together, with a guide.", label: "Group Umrah", href: "/umrah/group", cta: "Browse group packages", features: ["Fixed price per person", "Scheduled departures", "Package hotels & services", "Group travel with a guide"] },
  { key: "private" as const, title: "Your party. Your plans.", label: "Private Umrah", href: "/umrah/private", cta: "Build a private trip", features: ["Price from your selections", "Choose your travel dates", "Select hotels in each city", "Your own family or party"] },
];

export function UmrahFlowComparison() {
  return <section id="umrah-compare" aria-labelledby="umrah-compare-heading" className="scroll-mt-28 py-14 sm:py-20"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="mb-9 text-center"><span className="text-[10px] tracking-[0.2em] text-primary uppercase">Two ways to the Haramain</span><h2 id="umrah-compare-heading" className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Group or private?</h2></div><div className="grid gap-5 md:grid-cols-2">{OPTIONS.map(o=><article key={o.key} className="overflow-hidden rounded-3xl border border-border bg-card"><div className={`relative grid items-center gap-2 px-6 pt-6 sm:grid-cols-[1fr_1.1fr] ${o.key==='group'?'bg-[#e9f0e2]':'bg-[#f4eddf]'}`}><div className="relative z-10"><span className="text-[10px] font-semibold tracking-[0.15em] text-[#65816a] uppercase">{o.label}</span><h3 className="mt-3 font-heading text-2xl leading-tight font-semibold text-[#153f32]">{o.title}</h3></div><UmrahIllustration scene={o.key} /></div><div className="p-6 sm:p-7"><ul className="grid gap-3 sm:grid-cols-2">{o.features.map(f=><li key={f} className="flex items-start gap-2 text-xs leading-relaxed"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />{f}</li>)}</ul><Link href={o.href} className={`mt-7 flex min-h-12 items-center justify-between gap-3 rounded-xl px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${o.key==='group'?'bg-primary text-white hover:bg-primary/90':'bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90'}`}>{o.cta}<ArrowRight className="size-4" aria-hidden /></Link></div></article>)}</div></div></section>;
}
