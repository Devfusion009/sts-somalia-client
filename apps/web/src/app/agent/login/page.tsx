import type { Metadata } from "next";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { signInToAgentPortalAction } from "@/lib/auth/actions";
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
      <PortalLoginForm
        title="Agent sign-in"
        description="Log in to manage bookings, wallet balance, and commission for your agency."
        action={signInToAgentPortalAction}
        redirectTo={redirect_to}
        demoAccount={DEMO_LOGIN_ENABLED ? DEMO_ACCOUNTS.agent : undefined}
      />
    </PortalLoginShell>
  );
}
