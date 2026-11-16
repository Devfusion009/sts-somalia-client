import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { countryFlag, countryName } from "@/lib/countries";
import { getMyAgency } from "@/modules/agencies/queries";
import { agencyLogoUrl } from "@/modules/agencies/logo";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { AgencyLogoUploader } from "./agency-logo-uploader";
import { AgencyProfileForm, ProfileSection } from "./agency-profile-form";

export const metadata: Metadata = { title: "Agency Profile" };

export default async function AgentSettingsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { agency, roleInAgency } = membership;
  const canManage = roleInAgency === "owner" || roleInAgency === "admin";

  const logoUrl = agencyLogoUrl(agency.logo_path);
  const country = agency.country_code ? `${countryFlag(agency.country_code)} ${countryName(agency.country_code)}` : null;
  const sections: { title: string; items: { label: string; value: string | null; wide?: boolean }[] }[] = [
    {
      title: "Business details",
      items: [
        { label: "Agency name", value: agency.name },
        { label: "Legal name", value: agency.legal_name },
        { label: "Registration number", value: agency.registration_number },
        { label: "Country", value: country },
      ],
    },
    {
      title: "Contact",
      items: [
        { label: "Contact email", value: agency.contact_email },
        { label: "Contact phone", value: agency.contact_phone },
        { label: "Website", value: agency.website },
        { label: "Office address", value: agency.address },
      ],
    },
    { title: "About", items: [{ label: "About the agency", value: agency.about, wide: true }] },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Agency profile"
        status={!canManage ? <Badge variant="neutral">Read only</Badge> : null}
      />

      <div className="rounded-2xl border border-border bg-card shadow-xs">
        <div className="divide-y divide-border">
          <ProfileSection title="Logo">
            {canManage ? (
              <AgencyLogoUploader logoUrl={logoUrl} />
            ) : (
              <div className="flex size-24 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-muted-foreground">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Agency logo" className="size-full object-contain p-1.5" />
                ) : (
                  <Building2 className="size-7" aria-hidden="true" />
                )}
              </div>
            )}
          </ProfileSection>

          {canManage ? (
            <AgencyProfileForm
              name={agency.name}
              legalName={agency.legal_name}
              registrationNumber={agency.registration_number}
              contactEmail={agency.contact_email}
              contactPhone={agency.contact_phone}
              countryCode={agency.country_code}
              about={agency.about}
              website={agency.website}
              address={agency.address}
            />
          ) : (
            sections.map((section) => (
              <ProfileSection key={section.title} title={section.title}>
                <dl className="grid gap-x-5 gap-y-5 text-sm sm:grid-cols-2">
                  {section.items.map((item) => (
                    <div key={item.label} className={item.wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
                      <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
                      <dd className="mt-1.5 rounded-xl bg-secondary/70 px-3.5 py-2.5 font-medium break-words whitespace-pre-line">{item.value ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </ProfileSection>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
