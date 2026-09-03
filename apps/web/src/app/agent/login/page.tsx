import type { Metadata } from "next";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { signInToAgentPortalAction } from "@/lib/auth/actions";
import { DEMO_LOGIN_ENABLED, DEMO_ACCOUNTS } from "@/modules/demo/config";
import { DemoLoginButton } from "@/modules/demo/demo-login-button";

export const metadata: Metadata = { title: "Agent Portal — Log in" };

export default async function AgentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;

  return (
    <PortalLoginShell portalLabel="Agent Portal" accent="agent">
      <PortalLoginForm
        title="Agent sign-in"
        description="Log in to manage bookings, wallet balance, and commission for your agency."
        action={signInToAgentPortalAction}
        redirectTo={redirect_to}
      />
      {DEMO_LOGIN_ENABLED ? (
        <DemoLoginButton
          action={signInToAgentPortalAction}
          email={DEMO_ACCOUNTS.agent.email}
          password={DEMO_ACCOUNTS.agent.password}
          label={DEMO_ACCOUNTS.agent.label}
        />
      ) : null}
    </PortalLoginShell>
  );
}
