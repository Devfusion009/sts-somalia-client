"use client";

import { useOptimistic, useState, useTransition } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BookUser,
  CalendarCheck,
  Clock,
  Hourglass,
  ListChecks,
  Globe2,
  Loader2,
  Plane,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
} from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { COUNTRY_OPTIONS, countryFlag, countryName, countrySearchText, normalizeSearchTerm } from "@/lib/countries";
import { cn } from "@/lib/utils";

const COUNTRY_CODES = COUNTRY_OPTIONS.map(([code]) => code);
const countryLabel = (code: string) => `${countryFlag(code)} ${countryName(code)}`;

/** Word-start match: "ke" finds Kenya before every name that merely contains "ke". */
function matchesCountry(code: string, query: string) {
  const q = normalizeSearchTerm(query);
  if (!q) return true;
  return countrySearchText(code)
    .split(/[\s-]+/)
    .some((word) => word.startsWith(q));
}

const SELECTOR_ID = "visa-nationality";
const ERROR_ID = "visa-nationality-error";

export type VisaMetricKey = "processing" | "validity" | "stay" | "price";
export type VisaMetric = { key: VisaMetricKey; label: string; value: string; live?: boolean };

const METRIC_ICON: Record<VisaMetricKey, LucideIcon> = {
  processing: Clock,
  validity: CalendarCheck,
  stay: Hourglass,
  price: Wallet,
};

/**
 * Visa detail overview: destination photo with the route and title, the
 * product's key facts, and the passport picker. Picking a passport re-prices
 * the page and reloads its document list for that passport (?nationality=XX)
 * without leaving the page. A passport from the destination country itself is
 * refused.
 */
export function VisaOverview({
  visaName,
  destinationCode,
  nationality,
  metrics,
  requirementsId,
  coverImage,
}: {
  visaName: string;
  overview: string | null;
  destinationCode: string;
  /** ISO code of the chosen passport, from the URL. */
  nationality: string | null;
  metrics: VisaMetric[];
  /** Heading id of the requirements section, focused by "View requirements". */
  requirementsId: string;
  coverImage: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // The chosen passport shows at once; price and documents follow from the server.
  const [passport, setPassport] = useOptimistic(nationality);
  const [error, setError] = useState<string | null>(null);
  const destinationName = countryName(destinationCode);

  function choosePassport(code: string | null) {
    if (!code || code === passport) return;
    if (code === destinationCode) {
      setError("Choose a passport from another country.");
      return;
    }
    setError(null);
    startTransition(() => {
      setPassport(code);
      router.replace(`${pathname}?nationality=${code}`, { scroll: false });
    });
  }

  function focusSelector() {
    document.getElementById(SELECTOR_ID)?.focus();
  }

  function showRequirements() {
    const heading = document.getElementById(requirementsId);
    if (!heading) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    heading.focus({ preventScroll: true });
  }

  return (
    <section
      aria-labelledby="visa-title"
      className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_14px_45px_-25px_rgba(7,60,52,0.25)]"
    >
      <div className="relative grid overflow-hidden bg-[#073c34] text-white lg:grid-cols-[1.1fr_1fr]">
        <div className="relative z-10 flex flex-col items-start px-6 py-8 sm:px-9 sm:py-10 lg:p-10">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[#a7d7c9] uppercase">
            <span className="h-px w-7 bg-[#d4b681]" aria-hidden /> STS visa services
          </span>
          <h1 id="visa-title" className="mt-7 max-w-xl font-heading text-4xl leading-[1.08] font-semibold tracking-[-0.045em] text-balance sm:text-5xl lg:text-[3.4rem]">
            {visaName}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-white/90">
              <span aria-hidden>{countryFlag(destinationCode)}</span>{destinationName}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#badacd]"><ShieldCheck className="size-4" aria-hidden /> ISO-certified company</span>
          </div>
          <button type="button" onClick={focusSelector} className="mt-9 inline-flex min-h-11 items-center gap-2 border-b border-[#a7d7c9]/40 text-sm font-medium text-[#c4e6d8] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <BookUser className="size-4" aria-hidden />
            {passport ? `${countryName(passport)} passport` : "Select your passport"}
            <ArrowRight className="ml-2 size-4" aria-hidden />
          </button>
        </div>
        <div className="relative min-h-48 overflow-hidden lg:min-h-80">
          {coverImage ? <Image src={coverImage} alt={`${destinationName} cityscape`} fill preload sizes="(min-width: 1280px) 580px, (min-width: 1024px) 50vw, 100vw" unoptimized={!coverImage.startsWith("/")} className="object-cover" /> : <div className="absolute inset-0 grid place-items-center bg-[#125547]"><Globe2 className="size-40 text-[#a7d7c9]/30" strokeWidth={0.6} aria-hidden /></div>}
          <div className="absolute inset-0 bg-linear-to-t from-[#042c25]/75 via-transparent to-transparent" aria-hidden />
          <div className="absolute inset-x-6 bottom-5 flex items-center justify-between border-t border-white/35 pt-3 text-xs font-medium tracking-wide text-white sm:inset-x-9">
            <span>{destinationName}</span><span className="font-mono text-white/80">{destinationCode} / STS</span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7 lg:p-8">
        <dl className="grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = METRIC_ICON[metric.key];
            return (
              <div
                key={metric.key}
                className="flex min-w-0 flex-col gap-2 border-l-2 border-primary/20 pl-4 sm:flex-row sm:items-center sm:gap-3"
              >
                <span
                  className="hidden size-10 shrink-0 place-items-center rounded-xl bg-primary/7 text-primary xl:grid"
                  aria-hidden
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium text-muted-foreground">{metric.label}</dt>
                  <dd
                    className={cn(
                      "mt-1 font-heading text-base font-semibold break-words tabular-nums transition-opacity sm:text-lg",
                      metric.live && pending && "opacity-40"
                    )}
                  >
                    {metric.value}
                  </dd>
                </div>
              </div>
            );
          })}
        </dl>

        {/* Passport picker, laid out as the route it prices */}
        <div className="mt-7 border-t border-border pt-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
            <div className="min-w-0 space-y-2">
              <label htmlFor={SELECTOR_ID} className="flex items-center gap-2 text-xs font-semibold">
                Your passport nationality
                {pending ? (
                  <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden /> Updating
                  </span>
                ) : null}
              </label>
              <Combobox
                items={COUNTRY_CODES}
                itemToStringLabel={countryLabel}
                filter={matchesCountry}
                value={passport}
                onValueChange={(code) => choosePassport(code)}
                autoHighlight
              >
                <ComboboxInputGroup>
                  <ComboboxInput
                    id={SELECTOR_ID}
                    placeholder="Search for a country"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? ERROR_ID : undefined}
                    className={cn(
                      "h-12 rounded-xl px-3.5 text-base font-medium",
                      !passport && !error && "border-brand-accent/60"
                    )}
                  />
                </ComboboxInputGroup>
                <ComboboxPortal>
                  <ComboboxPositioner>
                    <ComboboxPopup>
                      <ComboboxEmpty>No country found.</ComboboxEmpty>
                      <ComboboxList>
                        {(code: string) => (
                          <ComboboxItem key={code} value={code}>
                            {countryLabel(code)}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxPopup>
                  </ComboboxPositioner>
                </ComboboxPortal>
              </Combobox>
            </div>

            <div className="hidden items-center gap-1 pb-3 text-primary lg:flex" aria-hidden>
              <span className="w-6 border-t-2 border-dashed border-primary/40" />
              <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                <Plane className="size-4" />
              </span>
              <span className="w-6 border-t-2 border-dashed border-primary/40" />
            </div>

            <div className="min-w-0 space-y-2">
              <span className="block text-xs font-semibold">Destination</span>
              <span className="flex h-12 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 font-heading text-base font-bold">
                <span className="text-xl leading-none" aria-hidden>
                  {countryFlag(destinationCode)}
                </span>
                {destinationName}
              </span>
            </div>

            <Button type="button" size="lg" className="h-12 gap-2 rounded-xl px-4 text-sm" onClick={showRequirements}>
              <ListChecks aria-hidden /> View requirements
            </Button>
          </div>

          {error ? (
            <p id={ERROR_ID} role="alert" className="mt-3 flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden /> {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
