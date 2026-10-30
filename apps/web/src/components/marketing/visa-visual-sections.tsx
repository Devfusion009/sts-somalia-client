import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { VisaIllustration, type VisaScene } from "./visa-illustrations";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";

const STEPS: { scene: VisaScene; title: string; label: string }[] = [
  { scene: "destination", title: "Choose your destination", label: "Explore" },
  { scene: "application", title: "Complete your application", label: "Prepare" },
  { scene: "review", title: "Specialist document review", label: "Review" },
  { scene: "decision", title: "Submission & decision", label: "Track" },
];

const DOCUMENTS: { scene: VisaScene; title: string; tag: string }[] = [
  { scene: "passport", title: "Passport", tag: "Identity" },
  { scene: "photo", title: "Passport photographs", tag: "Photographs" },
  { scene: "funds", title: "Proof of funds", tag: "Finances" },
  { scene: "flight", title: "Travel itinerary", tag: "Travel" },
  { scene: "stay", title: "Accommodation", tag: "Your stay" },
  { scene: "insurance", title: "Travel insurance", tag: "Cover" },
  { scene: "appointment", title: "Appointment confirmation", tag: "Appointments" },
  { scene: "invitation", title: "Invitation letter", tag: "Supporting documents" },
];

export function VisaProcess() {
  return (
    <section aria-labelledby="visa-process-heading" className="relative isolate overflow-hidden bg-[#073c34] py-14 text-white sm:py-20">
      <div className="pointer-events-none absolute -top-72 -right-40 -z-10 size-[650px] rounded-full border border-white/10" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><span className="text-[10px] font-semibold tracking-[0.2em] text-[#abcdb9] uppercase">The visa journey</span><h2 id="visa-process-heading" className="mt-3 max-w-xl font-heading text-3xl leading-tight font-medium tracking-tight sm:text-4xl">From the first form<br className="hidden sm:block" /> to your next departure.</h2></div>
          <Link href="#visa-results" className="inline-flex min-h-11 items-center gap-3 rounded-full border border-white/25 px-5 text-sm transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Find your visa <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
        </div>
        <ol className="relative mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.scene} className="group relative min-w-0">
              <div className="relative overflow-hidden rounded-[1.4rem] border border-[#dbdfca]/60 bg-[#eef1e5]">
                <span className="absolute top-4 left-4 z-10 grid size-8 place-items-center rounded-full border border-[#b8c9b6] text-[11px] font-semibold text-[#305d49] tabular-nums">0{i + 1}</span>
                <VisaIllustration scene={step.scene} className="aspect-[7/5] w-full" />
                <div className="absolute right-3 bottom-3 size-2 rounded-full bg-[#b28a51]" aria-hidden="true" />
              </div>
              <div className="relative mt-5 border-t border-[#5f8876] pt-4"><span className="absolute -top-[4px] left-0 size-[7px] rounded-full bg-[#d3bc87]" aria-hidden="true" /><span className="text-[9px] font-medium tracking-[0.18em] text-[#afcbbd] uppercase">{step.label}</span><h3 className="mt-2 pr-4 font-heading text-base font-medium">{step.title}</h3></div>
              {i < STEPS.length - 1 ? <span className="absolute top-[40%] -right-5 z-10 hidden size-5 items-center justify-center rounded-full bg-[#073c34] text-[#d9c797] ring-4 ring-[#073c34] lg:flex" aria-hidden="true"><ArrowRight className="size-3.5" /></span> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function VisaDocuments() {
  return (
    <section aria-labelledby="visa-essentials-heading" className="border-b border-[#dfe6dc] bg-[#f7f7f0] py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><span className="text-[10px] font-semibold tracking-[0.2em] text-[#67816d] uppercase">Before you apply</span><h2 id="visa-essentials-heading" className="mt-3 font-heading text-3xl font-semibold tracking-tight text-[#133f32] sm:text-4xl">Your travel documents,<br className="hidden sm:block" /> beautifully in order.</h2></div><Link href="#visa-results" className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Requirements by destination <ArrowUpRight className="size-4" aria-hidden="true" /></Link></div>
        <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DOCUMENTS.map((doc, i) => (
            <li key={doc.scene} className="relative overflow-hidden rounded-[1.4rem] border border-[#dce4d8] bg-[#fffef9]">
              <div className="relative flex h-44 items-center justify-center border-b border-[#e7ebdf] bg-[radial-gradient(ellipse_at_50%_80%,#dce9da_0%,#f2f4e9_68%)] sm:h-48">
                <span className="absolute top-4 left-5 text-[9px] font-medium tracking-[0.15em] text-[#64806b] uppercase">{doc.tag}</span>
                <VisaIllustration scene={doc.scene} className="h-full w-full max-w-[280px]" />
              </div>
              <div className="flex items-center gap-3 px-5 py-5"><span className="text-[10px] font-medium text-[#7c9380] tabular-nums">0{i + 1}</span><h3 className="font-heading text-base font-semibold text-[#153f33]">{doc.title}</h3></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const BENEFITS: { scene: VisaScene; title: string; tag: string }[] = [
  { scene: "review", title: "Specialist document review", tag: "Attention to detail" },
  { scene: "tracking", title: "Application status tracking", tag: "Every stage" },
  { scene: "family", title: "Individual, family & group visas", tag: "Together or solo" },
  { scene: "payment", title: "EVC Plus, bank & card", tag: "Local payments" },
];

export function VisaBenefits() {
  return (
    <section aria-labelledby="visa-benefits-heading" className="bg-background py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><span className="text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">The STS difference</span><h2 id="visa-benefits-heading" className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Care in every detail.</h2></div><span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"><ShieldCheck className="size-4 text-primary" aria-hidden="true" /> ISO-certified company</span></div>
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.4fr]">
          <div className="relative isolate flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] bg-[#073c34] px-7 py-8 text-white sm:px-9">
            <div className="absolute -top-28 -right-28 -z-10 size-80 rounded-full border border-[#80a28b]/25" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-[0.18em] text-[#b6cfbc] uppercase">The people behind your application</span>
            <div className="relative mx-auto my-6 w-full max-w-64 rounded-full bg-[#e5ecdd]"><VisaIllustration scene="support" className="aspect-[7/5] w-full" /></div>
            <h3 className="font-heading text-3xl leading-tight font-medium tracking-tight">A real team.<br /><span className="text-[#b9d3c1]">Right here in Somalia.</span></h3>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#c3d8cb]">{["Support in Somali", "Mogadishu visa desk"].map(item => <li key={item} className="flex items-center gap-1.5"><Check className="size-3.5 text-[#d6c193]" aria-hidden="true" />{item}</li>)}</ul>
            <a href={SUPPORT_PHONE_TEL} className="mt-7 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/20 px-4 text-sm font-semibold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{SUPPORT_PHONE_DISPLAY}<ArrowUpRight className="size-4" aria-hidden="true" /></a>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {BENEFITS.map(point => <li key={point.scene} className="flex min-w-0 flex-col rounded-[1.4rem] border border-border bg-card p-5 sm:p-6"><VisaIllustration scene={point.scene} className="mx-auto h-36 w-full max-w-56" /><span className="mt-3 text-[9px] font-medium tracking-[0.16em] text-[#718778] uppercase">{point.tag}</span><h3 className="mt-2 font-heading text-base font-semibold">{point.title}</h3></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
