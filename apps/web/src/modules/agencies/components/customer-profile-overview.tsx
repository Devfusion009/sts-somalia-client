import type { ReactNode } from "react";
import { ArrowUpRight, FileCheck2 } from "lucide-react";
import { format } from "date-fns";
import { countryName } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import type { CustomerProfile } from "./customer-profile-fields";
import styles from "./customer-profile.module.css";

const date = (value: string | null) => value ? format(new Date(`${value}T00:00:00Z`), "d MMM yyyy") : null;
const country = (value: string | null) => value ? countryName(value.trim()) : null;
const cabin: Record<string, string> = { economy: "Economy", premium_economy: "Premium economy", business: "Business", first: "First" };

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className={styles.profileFacts}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="text-muted-foreground">Not provided</span>}</dd></div>)}</dl>;
}

export function CustomerProfileOverview({ customer: c }: { customer: CustomerProfile }) {
  const expired = c.passport_expiry_date && c.passport_expiry_date <= new Date().toISOString().slice(0, 10);
  return (
    <div className={styles.profileGrid}>
      <section className={styles.profileSection} aria-labelledby="personal-details-title">
        <h2 id="personal-details-title">Personal details</h2>
        <Facts rows={[["First name", c.first_name], ["Last name", c.last_name], ["Middle name", c.middle_name], ["Gender", c.gender === "male" ? "Male" : c.gender === "female" ? "Female" : null], ["Date of birth", date(c.date_of_birth)], ["Nationality", country(c.nationality)], ["Place of birth", c.birth_place]]} />
      </section>
      <section className={styles.profileSection} aria-labelledby="contact-details-title">
        <h2 id="contact-details-title">Contact & address</h2>
        <Facts rows={[["Mobile number", c.phone], ["WhatsApp", c.whatsapp], ["Email address", c.email], ["Country of residence", country(c.residence_country)], ["Street address", c.address], ["City", c.city], ["Postal code", c.postal_code]]} />
      </section>
      <section className={styles.profileSection} aria-labelledby="passport-details-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><h2 id="passport-details-title">Passport & document</h2><Badge variant={expired ? "destructive" : c.passport_file_path ? "success" : "warning"}>{expired ? "Passport expired" : c.passport_file_path ? "Document on file" : "Document missing"}</Badge></div>
        <Facts rows={[["Passport number", c.passport_number], ["Issuing country", country(c.passport_issuing_country)], ["Place of issue", c.passport_issuance_location], ["Issue date", date(c.passport_issue_date)], ["Expiry date", date(c.passport_expiry_date)]]} />
        {c.passport_file_path ? <a href={`/agent/customers/${c.id}/passport`} target="_blank" rel="noopener noreferrer" className={styles.documentLink}><span className="inline-flex items-center gap-2"><FileCheck2 className="size-4" aria-hidden="true" />View passport copy</span><ArrowUpRight className="size-4" aria-hidden="true" /></a> : null}
      </section>
      <section className={styles.profileSection} aria-labelledby="travel-details-title">
        <h2 id="travel-details-title">Travel & emergency</h2>
        <Facts rows={[["Emergency contact", c.emergency_contact_name], ["Contact number", c.emergency_contact_phone], ["Relationship", c.emergency_contact_relationship], ["Preferred cabin", c.preferred_cabin ? cabin[c.preferred_cabin] : null], ["Travel requirements", c.travel_preferences], ["Agency notes", c.notes]]} />
      </section>
    </div>
  );
}
