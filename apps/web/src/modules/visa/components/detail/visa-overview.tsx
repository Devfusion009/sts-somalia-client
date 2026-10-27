"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, BookUser, ListChecks, Loader2, ShieldCheck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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

export type VisaMetric = { label: string; value: string; live?: boolean };

/**
 * Visa detail overview: route (the traveller's passport to the destination),
 * title, the product's key facts and the passport nationality picker. Picking
 * a passport re-prices the page and reloads its document list for that
 * passport (?nationality=XX) without leaving the page.
 */
export function VisaOverview({
  visaName,
  overview,
  destinationCode,
  nationality,
  metrics,
  requirementsId,
}: {
  visaName: string;
  overview: string | null;
  destinationCode: string;
  /** ISO code of the chosen passport, from the URL. */
  nationality: string | null;
  metrics: VisaMetric[];
  /** Heading id of the requirements section, focused by "See price and requirements". */
  requirementsId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // The chosen passport shows at once; price and documents follow from the server.
  const [passport, setPassport] = useOptimistic(nationality);
  const destinationName = countryName(destinationCode);

  function choosePassport(code: string | null) {
    if (!code || code === passport) return;
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
      className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7 lg:p-9"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 py-1 pr-3.5 pl-1">
          <button
            type="button"
            onClick={focusSelector}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              passport ? "bg-card text-foreground" : "bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/15"
            )}
          >
            {passport ? (
              <span className="text-base leading-none" aria-hidden>
                {countryFlag(passport)}
              </span>
            ) : (
              <BookUser className="size-4" aria-hidden />
            )}
            {passport ? countryName(passport) : "Your passport"}
          </button>
          <ArrowRight className="size-3.5 text-primary" aria-hidden />
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <span className="text-base leading-none" aria-hidden>
              {countryFlag(destinationCode)}
            </span>
            {destinationName}
          </span>
        </div>
        <Badge variant="success" className="gap-1">
          <ShieldCheck aria-hidden /> Licensed Somali travel agency
        </Badge>
      </div>

      <h1
        id="visa-title"
        className="mt-5 font-heading text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.5rem]"
      >
        {visaName}
      </h1>
      {overview ? (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-[1.0625rem]">{overview}</p>
      ) : null}

      <dl className="mt-7 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-secondary/40 sm:grid-cols-4">
        {metrics.map((metric, i) => (
          <div
            key={metric.label}
            className={cn(
              "min-w-0 px-4 py-3.5 sm:px-5 sm:py-4",
              i % 2 === 1 && "border-l border-border",
              i >= 2 && "border-t border-border sm:border-t-0",
              i >= 1 && "sm:border-l"
            )}
          >
            <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{metric.label}</dt>
            <dd
              className={cn(
                "mt-1 font-heading text-base font-bold break-words tabular-nums transition-opacity sm:text-lg",
                metric.live && pending && "opacity-40"
              )}
            >
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 grid gap-3 border-t border-border pt-7 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-end sm:justify-between">
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
                className={cn("h-12 rounded-xl px-3.5 text-base font-medium", !passport && "border-brand-accent/60")}
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
        <Button type="button" variant="outline" size="lg" className="h-12 gap-2 rounded-xl px-5" onClick={showRequirements}>
          <ListChecks aria-hidden /> See price and requirements
        </Button>
      </div>
    </section>
  );
}
