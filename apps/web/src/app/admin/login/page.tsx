import type { Metadata } from "next";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { signInToAdminPortalAction } from "@/lib/auth/actions";
import { DEMO_LOGIN_ENABLED, DEMO_ACCOUNTS } from "@/modules/demo/config";
import { DemoLoginButton } from "@/modules/demo/demo-login-button";

export const metadata: Metadata = { title: "Admin Console — Log in" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;

  return (
    <PortalLoginShell portalLabel="Admin Console" accent="admin">
      <PortalLoginForm
        title="Admin sign-in"
        description="Restricted to STS Somalia platform administrators."
        action={signInToAdminPortalAction}
        redirectTo={redirect_to}
      />
      {DEMO_LOGIN_ENABLED ? (
        <DemoLoginButton
          action={signInToAdminPortalAction}
          email={DEMO_ACCOUNTS.admin.email}
          password={DEMO_ACCOUNTS.admin.password}
          label={DEMO_ACCOUNTS.admin.label}
        />
      ) : null}
    </PortalLoginShell>
  );
}
