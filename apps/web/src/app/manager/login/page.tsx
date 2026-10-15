import type { Metadata } from "next";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { signInToManagerPortalAction } from "@/lib/auth/actions";
import { DEMO_LOGIN_ENABLED, DEMO_ACCOUNTS } from "@/modules/demo/config";

export const metadata: Metadata = { title: "Manager Portal — Log in" };

export default async function ManagerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;

  return (
    <PortalLoginShell portalLabel="Manager Portal" accent="manager">
      <PortalLoginForm
        title="Manager sign-in"
        action={signInToManagerPortalAction}
        redirectTo={redirect_to}
        demoAccount={DEMO_LOGIN_ENABLED ? DEMO_ACCOUNTS.manager : undefined}
      />
    </PortalLoginShell>
  );
}
