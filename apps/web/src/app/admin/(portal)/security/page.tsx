import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { countUnusedRecoveryCodes } from "@/lib/auth/recovery-codes";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Security" };

export default async function AdminSecurityPage() {
  const profile = await requireUser();
  const [factors, recoveryCodesLeft] = await Promise.all([
    listVerifiedFactors(),
    countUnusedRecoveryCodes(profile.id).catch(() => 0),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Security" />
      <MfaSettings
        factors={factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null, created_at: f.created_at }))}
        recoveryCodesLeft={recoveryCodesLeft}
      />
    </div>
  );
}
