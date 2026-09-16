"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { splitPhoneValue } from "./country-codes";
import { CountryCodeSelect } from "./country-code-select";

const MAX_DIGITS = 10;

/**
 * Country-code select + digits-only number input, submitted as one
 * "+<dial><digits>" string under `name` via a hidden input (same
 * state-derived-hidden-field pattern as RepeatableRows, so it survives
 * React 19's post-action uncontrolled-field reset).
 */
export function PhoneField({
  name,
  defaultValue,
  required,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const initial = splitPhoneValue(defaultValue ?? "");
  const [dial, setDial] = useState(initial.dial);
  const [number, setNumber] = useState(initial.number);
  const [invalid, setInvalid] = useState(false);
  const lastWarnRef = useRef(0);

  function warn(message: string) {
    const now = Date.now();
    if (now - lastWarnRef.current < 1500) return;
    lastWarnRef.current = now;
    toast.warning(message);
  }

  function handleNumberChange(raw: string) {
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly !== raw.replace(/\s/g, "")) {
      warn("Mobile number can only contain digits.");
      setInvalid(true);
    } else {
      setInvalid(false);
    }

    if (digitsOnly.length > MAX_DIGITS) {
      warn(`Mobile number cannot exceed ${MAX_DIGITS} digits.`);
    }

    setNumber(digitsOnly.slice(0, MAX_DIGITS));
  }

  return (
    <div className="flex gap-2">
      <input type="hidden" name={name} value={number ? `${dial}${number}` : ""} />
      <CountryCodeSelect value={dial} onChange={setDial} />
      <Input
        inputMode="numeric"
        autoComplete="tel-national"
        value={number}
        onChange={(e) => handleNumberChange(e.target.value)}
        required={required}
        aria-invalid={invalid}
        className="flex-1"
      />
    </div>
  );
}
