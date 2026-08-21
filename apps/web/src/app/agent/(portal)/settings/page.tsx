import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency } from "@/modules/agencies/queries";
import { agencyLogoUrl } from "@/modules/agencies/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AgencyLogoUploader } from "./agency-logo-uploader";
import { AgencyProfileForm } from "./agency-profile-form";

export const metadata: Metadata = { title: "Agency Profile" };

export default async function AgentSettingsPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const { agency, roleInAgency } = membership;
  const canManage = roleInAgency === "owner" || roleInAgency === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Agency Profile</h1>
      </div>

      {!canManage ? (
        <Alert>
          <Info />
          <AlertDescription>
            Only the agency owner or an admin can edit the agency profile. You have read-only access.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <AgencyLogoUploader logoUrl={agencyLogoUrl(agency.logo_path)} />
          ) : (
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
              {agencyLogoUrl(agency.logo_path) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agencyLogoUrl(agency.logo_path)!} alt="Agency logo" className="size-full object-contain" />
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
            />
          ) : (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Agency name</dt>
                <dd className="font-medium">{agency.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Legal name</dt>
                <dd className="font-medium">{agency.legal_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Registration number</dt>
                <dd className="font-medium">{agency.registration_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Country</dt>
                <dd className="font-medium">{agency.country_code ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contact email</dt>
                <dd className="font-medium">{agency.contact_email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contact phone</dt>
                <dd className="font-medium">{agency.contact_phone ?? "—"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
