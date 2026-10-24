"use client";

import { useActionState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { AUTH_CONTROL } from "@/components/auth/auth-frame";
import { PasswordLabelRow } from "@/components/auth/portal-login-form";
import { signInAction } from "@/lib/auth/actions";
import { portalLoginHref } from "@/lib/subdomain";
import { useRestoreOnError } from "@/lib/use-restore-on-error";
import { DemoAccountsList, type DemoAccountEntry } from "@/modules/demo/demo-accounts-list";

const AGENT_LOGIN_HREF = portalLoginHref("agent");
const MANAGER_LOGIN_HREF = portalLoginHref("manager");

const PORTAL_LINK =
  "inline-flex min-h-11 items-center gap-1 rounded-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-0";

/**
 * A single plain sign-in — same credentials for every account, personal or
 * business. Which portals an approved account can reach is discovered AFTER
 * signing in, via the account switcher (My Account banner, header dropdown,
 * portal sidebar footer — see getMyPartnerContexts()), not chosen up front
 * here. Previously this page asked "Personal or Business Account?" before
 * even taking credentials, which only ever covered agencies (not hotel
 * partners, affiliates, or venue partners) and didn't match how one account
 * can hold several partner identities at once.
 *
 * The one exception: /agent/login still exists as its own dedicated,
 * credentialed entry point, because portal sessions are host-only — once
 * subdomains are configured, a sign-in here can't hand off to agent.<host>.
 * That's surfaced as a quiet footnote link instead of a pre-login tab.
 *
 * Admin deliberately isn't mentioned anywhere on this page: that portal
 * stays reachable only via the dedicated, unlinked /admin/login.
 */
export function LoginForm({
  redirectTo,
  notice,
  demoAccounts,
}: {
  redirectTo?: string;
  notice?: string;
  /** Set only when DEMO_LOGIN_ENABLED is true server-side — see /login/page.tsx. */
  demoAccounts?: DemoAccountEntry[];
}) {
  const [personalState, personalAction] = useActionState(signInAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, personalState);

  return (
    <div className="grid w-full max-w-4xl overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.08] lg:grid-cols-2">
      <div className="relative hidden min-h-[36rem] lg:block">
        <Image
          src="/about/reception.webp"
          alt="STS Somalia office reception"
          fill
          priority
          sizes="(min-width: 1024px) 448px, 0px"
          className="object-cover object-[25%_50%]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="font-heading text-2xl font-semibold tracking-tight text-balance">
            Flights, hotels, visas and Umrah, booked with one account.
          </p>
          <p className="mt-2 text-sm text-white/80">Sultan Business Park, Mogadishu</p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10">
        <h1 className="font-heading text-xl font-semibold tracking-tight">Log in</h1>

        {notice ? (
          <Alert role="status" className="mt-6">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        <form ref={formRef} action={personalAction} className="mt-6">
          {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                spellCheck={false}
                required
                className={AUTH_CONTROL}
              />
            </Field>
            <Field>
              <PasswordLabelRow />
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                className={AUTH_CONTROL}
              />
            </Field>
            <FieldError>{personalState?.error}</FieldError>
            <SubmitButton size="lg" className="w-full" pendingText="Logging in…">
              Log in
            </SubmitButton>
          </FieldGroup>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>

        {demoAccounts ? (
          <div className="mt-6 border-t border-border pt-6">
            <DemoAccountsList accounts={demoAccounts} />
          </div>
        ) : null}

        {/* Real <a>, not <Link>: each portal is a separate origin once
            subdomains are configured, which a client-side route push cannot
            cross. Signing in above already reaches an approved partner's
            portal via the account switcher; these skip straight there. */}
        <nav
          aria-label="Portal sign-in"
          className="mt-6 flex flex-wrap items-center justify-center gap-x-6 border-t border-border pt-4 text-sm sm:pt-6"
        >
          <a href={AGENT_LOGIN_HREF} className={PORTAL_LINK}>
            Agent portal <ArrowRight aria-hidden className="size-3.5" />
          </a>
          <a href={MANAGER_LOGIN_HREF} className={PORTAL_LINK}>
            Manager portal <ArrowRight aria-hidden className="size-3.5" />
          </a>
        </nav>
      </div>
    </div>
  );
}
