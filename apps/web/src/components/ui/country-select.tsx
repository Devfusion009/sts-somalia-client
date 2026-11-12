"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { COUNTRY_OPTIONS, countryFlag, countrySearchText, normalizeSearchTerm } from "@/lib/countries";

const CODES = COUNTRY_OPTIONS.map(([code]) => code);
const NAME_BY_CODE = Object.fromEntries(COUNTRY_OPTIONS);
const labelOf = (code: string) => `${countryFlag(code)} ${NAME_BY_CODE[code]}`;

// The default contains-anywhere match buries the country someone actually wants
// (typing "i" matches every name with an "i" in it, in no useful order). Matching
// on a word start instead keeps the list to what the query actually starts —
// "i" -> India, Indonesia, Iran, Iraq, Ireland, Israel, Italy, in that order.
function matchesQuery(code: string, query: string) {
  const q = normalizeSearchTerm(query);
  if (!q) return true;
  return countrySearchText(code)
    .split(/[\s-]+/)
    .some((word) => word.startsWith(q));
}

/** Searchable nationality/country picker — flag stays visible in the input and the list. */
export function CountrySearchSelect({
  name,
  id,
  defaultValue,
  placeholder,
  required = false,
  className,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  placeholder: string;
  required?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState<string | null>(defaultValue || null);

  return (
    <Combobox
      items={CODES}
      itemToStringLabel={labelOf}
      filter={matchesQuery}
      value={value}
      onValueChange={setValue}
      autoHighlight
      required={required}
    >
      <input type="hidden" name={name} value={value ?? ""} />
      <ComboboxInputGroup>
        <ComboboxInput id={id} placeholder={placeholder} aria-required={required || undefined} className={cn("h-12 text-base font-medium", className)} />
      </ComboboxInputGroup>
      <ComboboxPortal>
        <ComboboxPositioner>
          <ComboboxPopup>
            <ComboboxEmpty>No country found.</ComboboxEmpty>
            <ComboboxList>
              {(code: string) => (
                <ComboboxItem key={code} value={code} className="min-h-11 py-2.5">
                  {labelOf(code)}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </ComboboxPositioner>
      </ComboboxPortal>
    </Combobox>
  );
}
