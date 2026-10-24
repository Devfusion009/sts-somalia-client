import type { Metadata } from "next";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { signInToAffiliatePortalAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Affiliate Dashboard — Log in" };

export default async function AffiliateLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;

  return (
    <PortalLoginShell portalLabel="Affiliate Dashboard" accent="affiliate">
      <PortalLoginForm
        title="Sign in"
        action={signInToAffiliatePortalAction}
        redirectTo={redirect_to}
      />
    </PortalLoginShell>
  );
}
