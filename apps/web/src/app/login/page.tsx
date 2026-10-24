import type { Metadata } from "next";
import { AuthLogo } from "@/components/auth/auth-frame";
import { LoginForm } from "./login-form";
import { DEMO_LOGIN_ENABLED, DEMO_ACCOUNTS } from "@/modules/demo/config";
import type { DemoAccountEntry } from "@/modules/demo/demo-accounts-list";
import {
  signInAction,
  signInToAgentPortalAction,
  signInToAdminPortalAction,
  signInToManagerPortalAction,
} from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Log in" };

const DEMO_ACCOUNT_ENTRIES: DemoAccountEntry[] = [
  { action: signInAction, ...DEMO_ACCOUNTS.customer },
  { action: signInToAgentPortalAction, ...DEMO_ACCOUNTS.agent },
  { action: signInToAdminPortalAction, ...DEMO_ACCOUNTS.admin },
  { action: signInToManagerPortalAction, ...DEMO_ACCOUNTS.manager },
];

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
      <AuthLogo href="/" />
      <LoginForm
        redirectTo={redirect_to}
        notice={notice}
        demoAccounts={DEMO_LOGIN_ENABLED ? DEMO_ACCOUNT_ENTRIES : undefined}
      />
    </div>
  );
}
