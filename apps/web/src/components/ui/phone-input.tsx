"use client";

import { useMemo, useState } from "react";
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
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  COUNTRY_OPTIONS,
  countryDialCode,
  countryFlag,
  countrySearchText,
  normalizeSearchTerm,
} from "@/lib/countries";

const CODES = COUNTRY_OPTIONS.map(([code]) => code);
const NAME_BY_CODE = Object.fromEntries(COUNTRY_OPTIONS);
const fullLabelOf = (code: string) => `${countryFlag(code)} ${NAME_BY_CODE[code]} (${countryDialCode(code)})`;

function matchesQuery(code: string, query: string) {
  const q = normalizeSearchTerm(query);
  if (!q) return true;
  if (countryDialCode(code).slice(1).startsWith(q.replace(/^\+/, ""))) return true;
  return countrySearchText(code)
    .split(/[\s-]+/)
    .some((word) => word.startsWith(q));
}

/** Splits a saved "+252 61XXXXXXX" value into its country and local digits. */
function splitPhone(value: string | undefined, defaultCountry: string) {
  const trimmed = (value ?? "").trim();
  if (!trimmed.startsWith("+")) return { country: defaultCountry, local: trimmed };
  const dial = CODES.map((code) => ({ code, prefix: countryDialCode(code) }))
    .filter(({ prefix }) => trimmed.startsWith(prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!dial) return { country: defaultCountry, local: trimmed.replace(/^\+\d*/, "").trim() };
  return { country: dial.code, local: trimmed.slice(dial.prefix.length).trim() };
}

/** Mobile number field with a searchable country calling-code picker, flag included. */
export function PhoneInput({
  name,
  id,
  defaultValue,
  defaultCountry = "SO",
  placeholder,
  required,
  className,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  /** ISO 3166-1 alpha-2 to preselect when defaultValue has no recognizable dial code. */
  defaultCountry?: string;
  placeholder?: string;
  required?: boolean;
  /** Applied to both the calling-code trigger and the number input, so they share a height. */
  className?: string;
}) {
  const initial = useMemo(() => splitPhone(defaultValue, defaultCountry), [defaultValue, defaultCountry]);
  const [country, setCountry] = useState(initial.country);
  const [local, setLocal] = useState(initial.local);
  const combined = local ? `${countryDialCode(country)} ${local}` : "";

  return (
    <div className="flex gap-2">
      <div className="w-28 shrink-0">
        <Combobox
          items={CODES}
          filter={matchesQuery}
          value={country}
          onValueChange={(next) => next && setCountry(next)}
          autoHighlight
        >
          <ComboboxTrigger aria-label="Country calling code" className={className}>
            <ComboboxValue>
              {(code: string) => (
                <span className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{countryFlag(code)}</span>
                  {countryDialCode(code)}
                </span>
              )}
            </ComboboxValue>
          </ComboboxTrigger>
          <ComboboxPortal>
            <ComboboxPositioner sideOffset={4} align="start">
              <ComboboxPopup className="w-72 min-w-72">
                <ComboboxInputGroup className="mb-1 px-1 pt-1">
                  <ComboboxInput placeholder="Search country or code" />
                </ComboboxInputGroup>
                <ComboboxEmpty>No country found.</ComboboxEmpty>
                <ComboboxList>
                  {(code: string) => (
                    <ComboboxItem key={code} value={code}>
                      {fullLabelOf(code)}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxPopup>
            </ComboboxPositioner>
          </ComboboxPortal>
        </Combobox>
      </div>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={cn("flex-1", className)}
      />
      <input type="hidden" name={name} value={combined} />
    </div>
  );
}
