import type { Metadata } from "next";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { AdminLoginBrandPanel } from "@/components/auth/admin-login-panel";
import { AuthFooterLink, AuthLogo } from "@/components/auth/auth-frame";
import { signInToAdminPortalAction } from "@/lib/auth/actions";
import { DEMO_LOGIN_ENABLED, DEMO_ACCOUNTS } from "@/modules/demo/config";
import { rootOrigin } from "@/lib/subdomain";

export const metadata: Metadata = { title: "Admin Console — Log in" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;
  const root = rootOrigin();

  return (
    <div className="flex min-h-dvh flex-col bg-secondary/30 lg:h-dvh lg:flex-row lg:gap-6 lg:p-6">
      <div className="flex min-h-dvh flex-1 flex-col justify-center px-4 py-12 sm:px-10 lg:min-h-0">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <AuthLogo href={root || "/"} label="Admin Console" className="self-center lg:self-start" />

          <PortalLoginForm
            title="Sign in"
            action={signInToAdminPortalAction}
            redirectTo={redirect_to}
            demoAccount={DEMO_LOGIN_ENABLED ? DEMO_ACCOUNTS.admin : undefined}
          />

          <div className="text-center">
            <AuthFooterLink href={root ? `${root}/login` : "/login"}>Customer sign-in</AuthFooterLink>
          </div>
        </div>
      </div>

      <div className="hidden lg:block lg:w-[45%] xl:w-[42%]">
        <AdminLoginBrandPanel />
      </div>
    </div>
  );
}
