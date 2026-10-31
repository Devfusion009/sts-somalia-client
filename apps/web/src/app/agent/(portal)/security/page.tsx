import { agentRecoveryHref } from "@/lib/agents/links";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { countUnusedRecoveryCodes } from "@/lib/auth/recovery-codes";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { getMyAgency } from "@/modules/agencies/queries";
import { ChangePasswordCard } from "@/modules/auth/components/security-panels";

export const metadata: Metadata = { title: "Security" };

export default async function AgentSecurityPage() {
  const profile = await requireUser();
  const [factors, membership, recoveryCodesLeft] = await Promise.all([
    listVerifiedFactors(),
    getMyAgency(profile.id),
    countUnusedRecoveryCodes(profile.id).catch(() => 0),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Security" />
      <StatRail className="sm:grid-cols-2">
        <StatRailItem
          label="Agent Code"
          value={<span className="font-mono text-base">{profile.agent_code ?? "—"}</span>}
        />
        <StatRailItem label="Email" value={<span className="text-base">{profile.email?.endsWith("@agent-login.scoutsts.invalid") ? membership?.agency.contact_email : profile.email}</span>} />
      </StatRail>
      <ChangePasswordCard forgotHref={agentRecoveryHref()} />
      <MfaSettings
        factors={factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null, created_at: f.created_at }))}
        recoveryCodesLeft={recoveryCodesLeft}
      />
    </div>
  );
}
