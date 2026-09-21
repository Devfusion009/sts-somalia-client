import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Globe, MapPin, Phone, ShieldCheck } from "lucide-react";
import { AgentLoginForm } from "@/components/auth/agent-login-form";
import { AgentLoginBrandPanel } from "@/components/auth/agent-login-panel";
import { signInToAgentPortalAction } from "@/lib/auth/actions";
import { DEMO_LOGIN_ENABLED, DEMO_ACCOUNTS } from "@/modules/demo/config";
import { rootOrigin } from "@/lib/subdomain";

export const metadata: Metadata = { title: "Agent Portal — Log in" };

export default async function AgentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_to?: string }>;
}) {
  const { redirect_to } = await searchParams;
  const root = rootOrigin();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Form panel */}
        <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-10 lg:w-[26rem] lg:shrink-0 lg:px-10 xl:w-[28rem]">
          <div className="mx-auto w-full max-w-sm">
            <Link href={root || "/"} className="block">
              <Image src="/logo.png" alt="STS Somalia" width={714} height={312} className="h-11 w-auto" priority />
              <p className="mt-1.5 text-xs font-bold tracking-[0.08em] text-brand-accent uppercase">
                Scout Travel Solution LTD
              </p>
            </Link>

            <div className="mt-8">
              <h1 className="font-heading text-2xl font-bold tracking-tight">B2B Agent Portal</h1>
            </div>

            <div className="mt-6">
              <AgentLoginForm
                action={signInToAgentPortalAction}
                redirectTo={redirect_to}
                demoAccount={DEMO_LOGIN_ENABLED ? DEMO_ACCOUNTS.agent : undefined}
              />
            </div>

            <Link
              href={root ? `${root}/login` : "/login"}
              className="mt-6 block text-center text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              Not the right account? Customer sign-in
            </Link>

            <div className="mt-10 flex items-center gap-3 border-t border-border pt-6">
              <ShieldCheck className="size-8 shrink-0 text-primary" strokeWidth={1.5} />
              <p className="text-xs leading-tight text-muted-foreground">
                <span className="font-semibold text-foreground">ISO 9001:2015</span>
                <br />
                Certified Travel Agency
              </p>
            </div>
          </div>
        </div>

        {/* Brand / office panel */}
        <div className="relative hidden flex-1 lg:block">
          <AgentLoginBrandPanel />
        </div>
      </div>

      {/* Contact strip — full width, real details only */}
      <div className="bg-brand-accent text-brand-accent-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 py-3.5 text-sm font-medium sm:justify-between">
          <a href="tel:+252611444420" className="flex items-center gap-2">
            <Phone className="size-4 shrink-0" /> +252 611 444 420
          </a>
          <a href="https://scoutsts.com" target="_blank" rel="noreferrer" className="flex items-center gap-2">
            <Globe className="size-4 shrink-0" /> scoutsts.com
          </a>
          <span className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" /> Sultan Business Park, Waaberi District, 21 Oct Street, Muqdisho
          </span>
        </div>
      </div>
    </div>
  );
}
