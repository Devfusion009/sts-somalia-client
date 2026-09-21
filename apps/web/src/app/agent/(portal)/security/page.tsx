import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listVerifiedFactors } from "@/lib/auth/mfa";
import { MfaSettings } from "@/modules/auth/components/mfa-settings";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Security" };

export default async function AgentSecurityPage() {
  const profile = await requireUser();
  const factors = await listVerifiedFactors();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Security</h1>
      </div>
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Agent ID</p>
            <p className="mt-0.5 font-mono text-sm">{profile.agent_code ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Email</p>
            <p className="mt-0.5 text-sm">{profile.email}</p>
          </div>
        </CardContent>
      </Card>
      <MfaSettings
        factors={factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name ?? null }))}
      />
    </div>
  );
}
