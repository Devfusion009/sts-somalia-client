import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { countUnusedRecoveryCodes } from "@/lib/auth/recovery-codes";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyAgency } from "@/modules/agencies/queries";
import { UsernameForm } from "./username-form";

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
          label="Agent code"
          value={<span className="font-mono text-base">{membership?.agency.agent_code ?? "—"}</span>}
        />
        <StatRailItem label="Email" value={<span className="text-base">{profile.email}</span>} />
      </StatRail>
      {membership ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign-in</CardTitle>
          </CardHeader>
          <CardContent>
            <UsernameForm username={membership.username} />
          </CardContent>
        </Card>
      ) : null}
      <MfaSettings
        factors={factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null, created_at: f.created_at }))}
        recoveryCodesLeft={recoveryCodesLeft}
      />
    </div>
  );
}
