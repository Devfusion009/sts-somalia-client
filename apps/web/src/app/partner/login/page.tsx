import type { Metadata } from "next";
import { PortalLoginShell } from "@/components/auth/portal-login-shell";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { signInToPartnerPortalAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Partner Portal — Log in" };

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;

  return (
    <PortalLoginShell portalLabel="Partner Portal" accent="partner">
      <PortalLoginForm
        title="Hotel partner sign-in"
        description="Log in to manage your properties, rooms, and bookings."
        action={signInToPartnerPortalAction}
        redirectTo={redirect_to}
      />
    </PortalLoginShell>
  );
}
