import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { DEMO_LOGIN_ENABLED, DEMO_ACCOUNTS } from "@/modules/demo/config";

export const metadata: Metadata = { title: "Log in" };

/**
 * Lives at the top level (not under the (auth) route group) so it can use
 * its own wide two-column layout instead of the (auth) group's shared
 * max-w-sm shell — /signup, /forgot-password, /reset-password, and
 * /login/verify-2fa (still nested under (auth)/login/verify-2fa) keep that
 * narrower layout unchanged.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string; error?: string }>;
}) {
  const { redirect_to, error } = await searchParams;
  const notice = error === "confirmation_failed" ? "That link is invalid or has expired." : undefined;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-secondary/30 px-4 py-12">
      <Link href="/" className="flex items-center">
        <Image src="/logo.png" alt="STS Somalia" width={714} height={312} priority className="h-11 w-auto" />
      </Link>
      <LoginForm
        redirectTo={redirect_to}
        notice={notice}
        demoAccount={DEMO_LOGIN_ENABLED ? DEMO_ACCOUNTS.customer : undefined}
      />
    </div>
  );
}
