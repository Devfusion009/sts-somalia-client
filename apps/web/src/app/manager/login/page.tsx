import type { Metadata } from "next";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { signInToManagerPortalAction } from "@/lib/auth/actions";
import { DEMO_LOGIN_ENABLED, DEMO_ACCOUNTS } from "@/modules/demo/config";
import { DemoLoginButton } from "@/modules/demo/demo-login-button";

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
        title="Hotel manager sign-in"
        description="Log in to manage bookings, rooms, and your hotel profile."
        action={signInToManagerPortalAction}
        redirectTo={redirect_to}
      />
      {DEMO_LOGIN_ENABLED ? (
        <DemoLoginButton
          action={signInToManagerPortalAction}
          email={DEMO_ACCOUNTS.manager.email}
          password={DEMO_ACCOUNTS.manager.password}
          label={DEMO_ACCOUNTS.manager.label}
        />
      ) : null}
    </PortalLoginShell>
  );
}
