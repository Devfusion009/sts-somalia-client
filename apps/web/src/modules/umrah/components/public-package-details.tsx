import { publicUmrahAgentContactSchema, type PackageDetail } from "@sts/shared-types";

export function PublicPackageDetails({ pkg }: { pkg: Pick<PackageDetail, "facilities" | "accommodation_details" | "flight_details" | "transport_details" | "meals_note" | "nights_makkah" | "nights_madinah" | "contact_person_name" | "contact_person_phone"> & { agent_contacts?: unknown } }) {
  const contacts = publicUmrahAgentContactSchema.array().safeParse(pkg.agent_contacts ?? []);
  return <div className="space-y-5">
    <dl className="grid gap-4 sm:grid-cols-2">
      {[["Makkah stay", pkg.nights_makkah === null ? null : `${pkg.nights_makkah} nights`], ["Madinah stay", pkg.nights_madinah === null ? null : `${pkg.nights_madinah} nights`], ["Facilities", pkg.facilities], ["Accommodation", pkg.accommodation_details], ["Food & meals", pkg.meals_note], ["Flights", pkg.flight_details], ["Transport", pkg.transport_details]].map(([label, value]) => value ? <div key={label}><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-line text-sm">{value}</dd></div> : null)}
    </dl>
    {pkg.contact_person_name && pkg.contact_person_phone ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><span className="text-sm font-semibold">{pkg.contact_person_name}</span><a className="text-sm font-medium text-primary hover:underline" href={`tel:${pkg.contact_person_phone.replace(/[^+0-9]/g, "")}`}>{pkg.contact_person_phone}</a></div> : null}
    {contacts.success && contacts.data.length > 0 ? <div className="space-y-3"><h3 className="text-sm font-semibold">Contact an agent</h3>{contacts.data.map((contact,index) => <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><span className="text-sm font-medium">{contact.name}</span><a className="text-sm text-primary hover:underline" href={`tel:${contact.phone.replace(/[^+0-9]/g, "")}`}>{contact.phone}</a></div>)}</div> : null}
  </div>;
}
