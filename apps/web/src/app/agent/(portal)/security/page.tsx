import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";

export const metadata: Metadata = { title: "Security" };

export default async function AgentSecurityPage() {
  await requireUser();
  const factors = await listVerifiedFactors();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Security</h1>
      </div>
      <MfaSettings
        factors={factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null }))}
      />
    </div>
  );
}
