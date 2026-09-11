import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PortalLoginForm } from "@/components/auth/portal-login-form";
import { AdminLoginBrandPanel } from "@/components/auth/admin-login-panel";
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
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-secondary/25 lg:h-dvh lg:flex-row lg:gap-6 lg:overflow-visible lg:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -left-28 size-96 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/3 size-96 rounded-full bg-brand-accent/10 blur-3xl lg:hidden"
      />

      <div className="relative flex min-h-dvh flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:min-h-0">
        <div className="relative mx-auto w-full max-w-sm">
          <Link href={root || "/"} className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 p-1.5">
              <Image src="/logo-icon.png" alt="" width={790} height={790} className="size-full object-contain" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-heading font-semibold">STS Somalia</span>
              <span className="text-xs text-muted-foreground">Admin Console</span>
            </div>
          </Link>

          <div className="mt-10">
            <PortalLoginForm
              title="Admin sign-in"
              action={signInToAdminPortalAction}
              redirectTo={redirect_to}
              demoAccount={DEMO_LOGIN_ENABLED ? DEMO_ACCOUNTS.admin : undefined}
            />
          </div>

          <Link
            href={root ? `${root}/login` : "/login"}
            className="mt-6 block text-center text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            Not the right account? Customer sign-in
          </Link>
        </div>
      </div>

      <div className="relative hidden lg:block lg:w-[45%] xl:w-[42%]">
        <AdminLoginBrandPanel />
      </div>
    </div>
  );
}
