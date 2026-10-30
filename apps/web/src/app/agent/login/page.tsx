import type { Metadata } from "next";
import { AgentLoginForm } from "@/components/auth/agent-login-form";
import { AuthCard } from "@/components/auth/auth-frame";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { signInToAgentPortalAction, signInWithAgentCodeAction } from "@/lib/auth/actions";
import { DEMO_LOGIN_ENABLED, DEMO_ACCOUNTS } from "@/modules/demo/config";

export const metadata: Metadata = { title: "Agent Portal — Log in" };

export default async function AgentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;

  return (
    <PortalLoginShell portalLabel="Agent Portal" accent="agent">
      <AuthCard title="Sign in">
        <AgentLoginForm
          action={signInWithAgentCodeAction}
          demoAction={signInToAgentPortalAction}
          redirectTo={redirect_to}
          demoAccount={DEMO_LOGIN_ENABLED ? DEMO_ACCOUNTS.agent : undefined}
        />
      </AuthCard>
    </PortalLoginShell>
  );
}
