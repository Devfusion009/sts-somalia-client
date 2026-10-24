import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { agencyLogoUrl } from "@/modules/agencies/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AgencyLogoUploader } from "./agency-logo-uploader";
import { AgencyProfileForm } from "./agency-profile-form";

export const metadata: Metadata = { title: "Agency Profile" };

export default async function AgentSettingsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { agency, roleInAgency } = membership;
  const canManage = roleInAgency === "owner" || roleInAgency === "admin";

  const logoUrl = agencyLogoUrl(agency.logo_path);
  const details: { label: string; value: string | null; wide?: boolean }[] = [
    { label: "Agency name", value: agency.name },
    { label: "Legal name", value: agency.legal_name },
    { label: "Registration number", value: agency.registration_number },
    { label: "Country", value: agency.country_code },
    { label: "Contact email", value: agency.contact_email },
    { label: "Contact phone", value: agency.contact_phone },
    { label: "Website", value: agency.website },
    { label: "Office address", value: agency.address },
    { label: "About", value: agency.about, wide: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency profile"
        status={!canManage ? <Badge variant="neutral">Read only</Badge> : null}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <AgencyLogoUploader logoUrl={logoUrl} />
            ) : (
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl bg-muted">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Agency logo" className="size-full object-contain" />
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agency details</CardTitle>
          </CardHeader>
          <CardContent>
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
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                {details.map((item) => (
                  <div key={item.label} className={item.wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
                    <dt className="text-xs text-muted-foreground">{item.label}</dt>
                    <dd className="mt-0.5 font-medium break-words">{item.value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
