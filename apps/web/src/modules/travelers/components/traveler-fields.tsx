"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field as FieldRoot, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_OPTIONS, countryFlag } from "@/lib/countries";
import { RELATIONSHIPS } from "@/modules/visa/schemas";
import { PassportExpiryAlert } from "./passport-alert";
import type { TravelerProfile } from "../queries";

/**
 * The traveler/passport field set, shared by the Profile card and the saved
 * traveler dialog.
 *
 * One component rather than two near-identical forms: the six-month expiry
 * rule, the nationality vocabulary, and the date ordering constraint have to
 * behave the same for the account holder as for their family, and duplicating
 * the markup is how those quietly drift apart.
 */

const COUNTRY_ITEMS = COUNTRY_OPTIONS.map(([code, label]) => ({
  value: code,
  label: `${countryFlag(code)} ${label}`,
}));

const RELATIONSHIP_ITEMS = RELATIONSHIPS.filter((r) => r !== "self").map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

const GENDER_ITEMS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <FieldRoot>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
    </FieldRoot>
  );
}

export function TravelerFields({
  traveler,
  idPrefix,
  showRelationship,
  nameLabel = "Full name (as in passport)",
}: {
  traveler?: TravelerProfile | null;
  /** Namespaces the input ids so several copies can coexist on one page. */
  idPrefix: string;
  showRelationship: boolean;
  nameLabel?: string;
}) {
  // Held in state purely so the expiry warning updates as the date is picked,
  // rather than only after a round trip to the server.
  const [expiry, setExpiry] = useState(traveler?.passport_expiry ?? "");

  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field label={nameLabel} htmlFor={id("fullName")}>
          <Input
            id={id("fullName")}
            name="fullName"
            defaultValue={traveler?.full_name ?? ""}
            required
            autoComplete="name"
          />
        </Field>

        {showRelationship ? (
          <Field label="Relationship to you" htmlFor={id("relationship")}>
            <Select
              name="relationship"
              defaultValue={traveler?.relationship ?? "spouse"}
              items={RELATIONSHIP_ITEMS}
            >
              <SelectTrigger id={id("relationship")} className="w-full">
                <SelectValue placeholder="Select a relationship" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <Field label="Date of birth" htmlFor={id("dateOfBirth")}>
          <Input
            id={id("dateOfBirth")}
            name="dateOfBirth"
            type="date"
            defaultValue={traveler?.date_of_birth ?? ""}
          />
        </Field>

        <Field label="Gender" htmlFor={id("gender")}>
          <Select
            name="gender"
            defaultValue={traveler?.gender ?? undefined}
            items={GENDER_ITEMS}
          >
            <SelectTrigger id={id("gender")} className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {GENDER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Nationality" htmlFor={id("nationality")}>
          <Select
            name="nationality"
            defaultValue={traveler?.nationality ?? undefined}
            items={COUNTRY_ITEMS}
          >
            <SelectTrigger id={id("nationality")} className="w-full">
              <SelectValue placeholder="Select a nationality" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Passport number" htmlFor={id("passportNumber")}>
          <Input
            id={id("passportNumber")}
            name="passportNumber"
            defaultValue={traveler?.passport_number ?? ""}
            // Passport numbers are case-sensitive on most systems and are
            // always printed uppercase; autocapitalize saves a correction on
            // mobile. autoComplete is off — browsers have no correct entry for
            // this and will happily offer an unrelated saved value.
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="uppercase"
          />
        </Field>

        <Field label="Passport issue date" htmlFor={id("passportIssueDate")}>
          <Input
            id={id("passportIssueDate")}
            name="passportIssueDate"
            type="date"
            defaultValue={traveler?.passport_issue_date ?? ""}
          />
        </Field>

        <Field label="Passport expiry date" htmlFor={id("passportExpiry")}>
          <Input
            id={id("passportExpiry")}
            name="passportExpiry"
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </Field>
      </div>

      <PassportExpiryAlert expiry={expiry || null} />
    </div>
  );
}
