import { ArrowUpRight, Headphones, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";

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
    <section className={cn("relative overflow-hidden rounded-3xl border border-[#dbe6de] bg-[#edf3ef] p-6 text-[#123d33]", wide && "grid gap-8 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10", className)}>
      <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full border border-[#cadbd1]" aria-hidden />
      <div className="pointer-events-none absolute -top-12 -right-12 size-64 rounded-full border border-[#cadbd1]/60" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-[#537468] uppercase"><Headphones className="size-4" aria-hidden /> The STS visa desk</div>
        <h2 className={cn("mt-4 font-heading font-semibold tracking-tight text-balance", wide ? "max-w-lg text-3xl sm:text-4xl" : "text-2xl")}>
          A specialist.<br />At every step.
        </h2>
        <ul className={cn("mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#537468]", !wide && "flex-col")}>
          <li className="inline-flex items-center gap-2"><ShieldCheck className="size-3.5 text-[#00816c]" aria-hidden /> Document review</li>
          <li className="inline-flex items-center gap-2"><Users className="size-3.5 text-[#00816c]" aria-hidden /> Individual, family & group visas</li>
        </ul>
      </div>
      <a href={whatsappLink(message)} target="_blank" rel="noopener noreferrer" className={cn("group relative mt-6 flex min-h-12 items-center justify-between gap-4 rounded-xl border border-[#b8cdc1] bg-white/70 px-4 py-3 text-sm font-semibold text-[#073c34] transition-colors hover:border-[#073c34] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary", wide && "mt-0 lg:min-w-64")}>
        Talk to a visa expert <ArrowUpRight className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5" aria-hidden />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </section>
  );
}
