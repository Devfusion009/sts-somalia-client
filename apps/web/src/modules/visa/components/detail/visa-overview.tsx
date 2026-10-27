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
  overview,
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
  /** Heading id of the requirements section, focused by "See price and requirements". */
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
      setError(`Your passport can't be from ${destinationName}, the country you're applying to visit.`);
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
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
    >
      {/* Destination banner */}
      <div className="relative isolate overflow-hidden bg-[linear-gradient(135deg,var(--sidebar)_0%,color-mix(in_oklch,var(--primary),black_35%)_100%)] text-white">
        {coverImage ? (
          <Image
            src={coverImage}
            alt=""
            fill
            priority
            sizes="(min-width: 1280px) 1216px, 100vw"
            unoptimized={!coverImage.startsWith("/")}
            className="-z-10 object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="absolute -top-6 -right-4 -z-10 text-[11rem] leading-none opacity-20 select-none"
          >
            {countryFlag(destinationCode)}
          </span>
        )}
        <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-black/80 via-black/45 to-black/25" />

        <div className="px-5 pt-5 pb-7 sm:px-8 sm:pt-7 sm:pb-9 lg:px-10 lg:pt-9 lg:pb-11">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 py-1 pr-3.5 pl-1 ring-1 ring-white/25 backdrop-blur">
              <button
                type="button"
                onClick={focusSelector}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-white/60",
                  passport ? "bg-white text-neutral-900" : "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90"
                )}
              >
                {passport ? (
                  <span className="text-base leading-none" aria-hidden>
                    {countryFlag(passport)}
                  </span>
                ) : (
                  <BookUser className="size-4" aria-hidden />
                )}
                {passport ? countryName(passport) : "Choose your passport"}
              </button>
              <ArrowRight className="size-3.5 text-white/80" aria-hidden />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <span className="text-base leading-none" aria-hidden>
                  {countryFlag(destinationCode)}
                </span>
                {destinationName}
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              <ShieldCheck className="size-3.5" aria-hidden /> Licensed Somali travel agency
            </span>
          </div>

          <h1
            id="visa-title"
            className="mt-14 max-w-3xl font-heading text-3xl leading-[1.1] font-extrabold tracking-tight text-balance drop-shadow sm:mt-20 sm:text-4xl lg:mt-24 lg:text-5xl"
          >
            {visaName}
          </h1>
          {overview ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">{overview}</p>
          ) : null}
        </div>
      </div>

      <div className="p-5 sm:p-8 lg:p-10">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {metrics.map((metric) => {
            const Icon = METRIC_ICON[metric.key];
            return (
              <div
                key={metric.key}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3.5 sm:p-4"
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-11"
                  aria-hidden
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{metric.label}</dt>
                  <dd
                    className={cn(
                      "font-heading text-base font-bold break-words tabular-nums transition-opacity sm:text-lg",
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
        <div className="mt-6 rounded-2xl border border-border bg-secondary/30 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0 space-y-2">
              <label htmlFor={SELECTOR_ID} className="flex items-center gap-2 text-sm font-semibold">
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
              <span className="block text-sm font-semibold">Destination</span>
              <span className="flex h-12 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 font-heading text-base font-bold">
                <span className="text-xl leading-none" aria-hidden>
                  {countryFlag(destinationCode)}
                </span>
                {destinationName}
              </span>
            </div>

            <Button type="button" size="lg" className="h-12 gap-2 rounded-xl px-5" onClick={showRequirements}>
              <ListChecks aria-hidden /> See price and requirements
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
