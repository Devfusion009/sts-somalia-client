import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Security" };

export default async function AdminSecurityPage() {
  await requireUser();
  const factors = await listVerifiedFactors();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Security" />
      <MfaSettings
        factors={factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null }))}
      />
    </div>
  );
}
