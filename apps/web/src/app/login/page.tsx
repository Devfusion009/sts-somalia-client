import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { AuthLogo } from "@/components/auth/auth-frame";
import { SUPPORT_PHONE_TEL } from "@/lib/marketing-nav";
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
    <div className="min-h-dvh bg-card p-0 text-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.04fr)] lg:gap-0 lg:p-0">
      <aside aria-label="STS travel" className="relative isolate hidden min-h-dvh overflow-hidden bg-[#063b33] lg:flex">
        <Image src="/auth/sts-reception-v2.webp" alt="Artistic view of the STS travel reception" fill preload sizes="(min-width: 1024px) 50vw, 0px" className="object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-[#032d28]/65 via-transparent to-[#032d28]/50" aria-hidden="true" />
        <div className="relative z-10 flex w-full flex-col justify-between p-8 xl:p-10">
          <div>
            <span className="flex items-center gap-3 text-[10px] font-medium tracking-[0.22em] text-[#d6e5d9] uppercase"><span className="h-px w-7 bg-[#d3b27d]" aria-hidden="true" />Scout Travel Solution</span>
            <h2 className="mt-6 max-w-md font-heading text-4xl leading-[1.12] font-bold tracking-[-0.04em] text-white xl:text-[2.9rem]">Your travel desk.<br /><span className="text-brand-accent">Wherever you go.</span></h2>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/20 bg-[#073c34]/85 px-5 py-4 text-white">
            <span className="flex items-center gap-2 text-xs"><ShieldCheck className="size-4 text-[#d9c18d]" strokeWidth={1.5} aria-hidden="true" />ISO-certified company</span>
            <span className="text-[10px] font-medium tracking-wide text-[#d0dfd3]">Mogadishu · Nairobi</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col px-2 sm:px-6 lg:px-8 xl:px-14">
        <header className="flex min-h-16 items-center justify-between gap-5 py-3 lg:min-h-20">
          <AuthLogo href="/" />
          <Link href="/" className="inline-flex min-h-10 items-center gap-1.5 rounded-sm text-xs font-medium text-[#667b71] transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to website</Link>
        </header>
        <main className="flex flex-1 items-center justify-center py-10 sm:py-14 lg:py-8">
          <LoginForm
            redirectTo={redirect_to}
            notice={notice}
            demoAccounts={DEMO_LOGIN_ENABLED ? DEMO_ACCOUNT_ENTRIES : undefined}
          />
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-[#e1e8df] py-5 text-[11px] text-[#6c7f74]">
          <a href={SUPPORT_PHONE_TEL} className="inline-flex min-h-9 items-center gap-1 rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">Contact STS<ArrowUpRight className="size-3" aria-hidden="true" /></a>
          <nav aria-label="Legal" className="flex gap-5"><Link href="/privacy" className="inline-flex min-h-9 items-center rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">Privacy</Link><Link href="/terms" className="inline-flex min-h-9 items-center rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">Terms</Link></nav>
        </footer>
      </div>
    </div>
  );
}
