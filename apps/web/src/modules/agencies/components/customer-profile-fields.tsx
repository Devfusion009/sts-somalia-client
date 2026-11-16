"use client";

import { useId, type ReactNode } from "react";
import { Check, Paperclip } from "lucide-react";
import type { Database } from "@/lib/types/database.types";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CountrySearchSelect } from "@/components/ui/country-select";
import { FileField } from "@/components/ui/upload";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { PhoneField } from "@/modules/partner-applications/components/phone-field";
import styles from "./customer-profile.module.css";

export type CustomerProfile = Database["public"]["Tables"]["agency_customers"]["Row"];
export const CUSTOMER_SECTIONS = ["Personal details", "Contact & address", "Passport & document", "Travel & emergency"];
const SECTIONS = CUSTOMER_SECTIONS;

/** One section at a time, for the full-page registration flow. */
export type SteppedView = {
  step: number;
  /** Furthest step reached; earlier steps stay reachable from the nav. */
  reached: number;
  direction: "forward" | "back";
  onStepSelect: (step: number) => void;
};
const today = () => new Date().toISOString().slice(0, 10);

function Section({ id, number, children, stepped }: { id: string; number: number; children: ReactNode; stepped?: SteppedView }) {
  const active = !stepped || stepped.step === number - 1;
  return (
    <fieldset
      id={id}
      data-step={number - 1}
      hidden={!active}
      data-direction={stepped && active ? stepped.direction : undefined}
      className={stepped ? `${styles.formSection} ${styles.stepSection}` : styles.formSection}
    >
      <legend><span aria-hidden="true">0{number}</span>{SECTIONS[number - 1]}</legend>
      <div className={styles.fieldGrid}>{children}</div>
    </fieldset>
  );
}

/** Shared registration and edit fields, with a separate document replacement control. */
export function CustomerProfileFields({ withNotes = false, customer, stepped }: { withNotes?: boolean; customer?: Partial<CustomerProfile>; stepped?: SteppedView }) {
  const prefix = useId();
  const id = (name: string) => `${prefix}-${name}`;
  const value = (key: keyof CustomerProfile) => String(customer?.[key] ?? "");
  const legacyName = (customer?.full_name ?? "").trim().split(/\s+/);
  const field = (name: string, label: string, control: ReactNode, required = false, wide = false) => (
    <Field className={wide ? styles.wideField : undefined}>
      <FieldLabel htmlFor={id(name)}>{label}{required ? <span className="text-destructive" aria-hidden="true"> *</span> : null}</FieldLabel>
      {control}
    </Field>
  );
  const input = (name: string, label: string, key: keyof CustomerProfile, required = false, type = "text", extra = {}) => field(name, label,
    <Input id={id(name)} name={name} type={type} defaultValue={value(key)} required={required} maxLength={type === "text" ? 200 : undefined} autoComplete="off" {...extra} />, required);
  const phone = (name: string, label: string, key: keyof CustomerProfile, required = false) => field(name, label,
    <PhoneField id={id(name)} name={name} defaultValue={value(key)} required={required} />, required);
  const country = (name: string, label: string, key: keyof CustomerProfile, required = false) => field(name, label,
    <CountrySearchSelect id={id(name)} name={name} placeholder="Select country" defaultValue={value(key) || (customer ? undefined : "SO")} required={required} />, required);

  return (
    <div className={styles.fieldsLayout}>
      <nav className={styles.sectionNav} aria-label="Customer form sections">
        {stepped ? (
          <ol className={styles.stepList}>
            {SECTIONS.map((label, index) => {
              const state = index === stepped.step ? "current" : index < stepped.reached || index < stepped.step ? "done" : "upcoming";
              return (
                <li key={label}>
                  <button
                    type="button"
                    data-state={state}
                    aria-current={state === "current" ? "step" : undefined}
                    disabled={index > stepped.reached}
                    onClick={() => stepped.onStepSelect(index)}
                  >
                    <span className={styles.stepMarker} aria-hidden="true">{state === "done" ? <Check /> : `0${index + 1}`}</span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ol>
        ) : SECTIONS.map((label, index) => <a key={label} href={`#${id(`section-${index}`)}`}><span aria-hidden="true">0{index + 1}</span>{label}</a>)}
        <span className={styles.requiredKey}><span aria-hidden="true">*</span> Required fields</span>
      </nav>
      <div className={styles.sections}>
        <Section id={id("section-0")} number={1} stepped={stepped}>
          {input("firstName", "First name", "first_name", true, "text", { autoFocus: true, maxLength: 100, defaultValue: customer?.first_name ?? legacyName[0] ?? "" })}
          {input("lastName", "Last name", "last_name", true, "text", { maxLength: 100, defaultValue: customer?.last_name ?? legacyName.slice(1).join(" ") })}
          {input("middleName", "Middle name", "middle_name")}
          {field("gender", "Gender", <select id={id("gender")} name="gender" required defaultValue={value("gender")} className={NATIVE_SELECT_CLASS}><option value="" disabled>Select gender</option><option value="male">Male</option><option value="female">Female</option></select>, true)}
          {input("dateOfBirth", "Date of birth", "date_of_birth", true, "date", { max: today() })}
          {country("nationality", "Nationality", "nationality", true)}
          {input("birthPlace", "Place of birth", "birth_place")}
        </Section>
        <Section id={id("section-1")} number={2} stepped={stepped}>
          {phone("phone", "Mobile number", "phone", true)}
          {phone("whatsapp", "WhatsApp number", "whatsapp")}
          {input("email", "Email address", "email", true, "email")}
          {country("residenceCountry", "Country of residence", "residence_country")}
          {input("address", "Street address", "address")}
          {input("city", "City", "city")}
          {input("postalCode", "Postal code", "postal_code")}
        </Section>
        <Section id={id("section-2")} number={3} stepped={stepped}>
          {input("passportNumber", "Passport number", "passport_number", true, "text", { className: "uppercase", maxLength: 20 })}
          {country("passportIssuingCountry", "Issuing country", "passport_issuing_country", true)}
          {input("passportIssuanceLocation", "Place of issue", "passport_issuance_location")}
          {input("passportIssueDate", "Issue date", "passport_issue_date", true, "date", { max: today() })}
          {input("passportExpiryDate", "Expiry date", "passport_expiry_date", true, "date", { min: today() })}
          <div className={styles.documentField}>
            {customer?.passport_file_path ? <div className={styles.documentSaved}><Paperclip className="size-4" aria-hidden="true" />Passport copy on file<Check className="size-4" aria-hidden="true" /></div> : null}
            {field("passportCopy", customer?.passport_file_path ? "Replace passport copy · JPG, PNG or PDF · 5 MB max" : "Passport copy · JPG, PNG or PDF · 5 MB max",
              <FileField id={id("passportCopy")} name="passportCopy" accept="image/jpeg,image/png,application/pdf" maxBytes={5 * 1024 * 1024} required={!customer?.passport_file_path} />, !customer?.passport_file_path)}
          </div>
        </Section>
        <Section id={id("section-3")} number={4} stepped={stepped}>
          {input("emergencyContactName", "Emergency contact name", "emergency_contact_name")}
          {phone("emergencyContactPhone", "Emergency contact number", "emergency_contact_phone")}
          {input("emergencyContactRelationship", "Relationship to customer", "emergency_contact_relationship")}
          {field("preferredCabin", "Preferred cabin", <select id={id("preferredCabin")} name="preferredCabin" defaultValue={value("preferred_cabin")} className={NATIVE_SELECT_CLASS}><option value="">No preference</option><option value="economy">Economy</option><option value="premium_economy">Premium economy</option><option value="business">Business</option><option value="first">First</option></select>)}
          {field("travelPreferences", "Travel requirements", <Textarea id={id("travelPreferences")} name="travelPreferences" defaultValue={value("travel_preferences")} maxLength={2000} rows={3} placeholder="Room preferences, meals, accessibility requests" />, false, true)}
          {withNotes ? field("notes", "Agency notes", <Textarea id={id("notes")} name="notes" defaultValue={value("notes")} maxLength={2000} rows={3} />, false, true) : null}
        </Section>
      </div>
    </div>
  );
}
