import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";

export const metadata: Metadata = { title: "Security" };

export default async function AgentSecurityPage() {
  const profile = await requireUser();
  const factors = await listVerifiedFactors();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Security" />
      <StatRail className="sm:grid-cols-2">
        <StatRailItem label="Agent ID" value={<span className="font-mono text-base">{profile.agent_code ?? "—"}</span>} />
        <StatRailItem label="Email" value={<span className="text-base">{profile.email}</span>} />
      </StatRail>
      <MfaSettings
        factors={factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null }))}
      />
    </div>
  );
}
