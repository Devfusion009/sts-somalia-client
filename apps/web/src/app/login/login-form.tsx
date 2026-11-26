"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, LockKeyhole, Mail } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PasswordInput } from "@/components/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { PasswordLabelRow } from "@/components/auth/portal-login-form";
import { signInAction } from "@/lib/auth/actions";
import { portalLoginHref } from "@/lib/subdomain";
import { useRestoreOnError } from "@/lib/use-restore-on-error";
import { DemoAccountsList, type DemoAccountEntry } from "@/modules/demo/demo-accounts-list";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

const AGENT_LOGIN_HREF = portalLoginHref("agent");
const MANAGER_LOGIN_HREF = portalLoginHref("manager");

const LOGIN_CONTROL = "h-12 rounded-xl border-[#d6e0d7] bg-white shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-primary/15 [&_[data-slot=input-group-addon]]:text-[#7c9286] [&_[data-slot=input-group-addon]]:pl-3.5 [&_input]:text-base [&_input]:placeholder:text-[#9aaba0] sm:[&_input]:text-sm";
const PORTAL_LINK = "group flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[#dfe6dc] bg-white px-3.5 py-3 text-xs font-medium text-[#496356] transition-colors hover:border-primary/40 hover:bg-[#eef4ed] hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

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
  googleEnabled = false,
}: {
  redirectTo?: string;
  notice?: string;
  /** Set only when DEMO_LOGIN_ENABLED is true server-side — see /login/page.tsx. */
  demoAccounts?: DemoAccountEntry[];
  googleEnabled?: boolean;
}) {
  const [personalState, personalAction, pending] = useActionState(signInAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, personalState);

  return (
    <div className="w-full max-w-[390px]">
      <div className="mb-8">
        <span className="text-[10px] font-semibold tracking-[0.19em] text-[#648071] uppercase">Your STS account</span>
        <h1 className="mt-3 font-heading text-[2.25rem] leading-tight font-semibold tracking-[-0.045em] text-[#123b32] sm:text-[2.5rem]">Welcome back.</h1>
      </div>

        {notice ? (
          <Alert role="status" className="mt-6">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        {googleEnabled ? <div className="mt-7"><GoogleSignIn redirectTo={redirectTo} /></div> : null}
        <form ref={formRef} action={personalAction} aria-busy={pending} className="mt-7">
          {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="email" className="text-xs font-semibold text-[#314e40]">Email address</FieldLabel>
              <InputGroup className={LOGIN_CONTROL}>
              <InputGroupAddon><Mail className="size-4" strokeWidth={1.5} aria-hidden="true" /></InputGroupAddon>
              <InputGroupInput
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                spellCheck={false}
                required
                placeholder="you@example.com"
              />
              </InputGroup>
            </Field>
            <Field>
              <PasswordLabelRow />
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                startAddon={<LockKeyhole className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                className={LOGIN_CONTROL}
              />
            </Field>
            <FieldError>{personalState?.error}</FieldError>
            <SubmitButton size="lg" className="mt-1 h-12 w-full justify-between rounded-xl bg-[#0b5343] px-5 text-sm font-semibold text-white shadow-[0_4px_10px_-4px_rgba(7,60,52,0.3)] hover:bg-[#073c34]" pendingText="Logging in…">
              Log in <ArrowRight className="size-4" aria-hidden="true" />
            </SubmitButton>
          </FieldGroup>
        </form>

        <p className="mt-6 text-sm text-[#718477]">
          New to STS?{" "}
          <Link href={redirectTo ? `/signup?redirect_to=${encodeURIComponent(redirectTo)}` : "/signup"} className="rounded-sm font-semibold text-[#0b7159] underline decoration-[#c7d7ca] underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            Create an account
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
          className="mt-9 border-t border-[#dfe6dc] pt-6"
        >
          <span className="mb-3 block text-[9px] font-semibold tracking-[0.16em] text-[#809085] uppercase">Business portals</span>
          <div className="flex flex-wrap gap-3">
          <a href={AGENT_LOGIN_HREF} className={PORTAL_LINK}>
            <BriefcaseBusiness aria-hidden="true" className="size-4 shrink-0 text-[#6c8b78]" strokeWidth={1.5} />Agent portal <ArrowUpRight aria-hidden className="ml-auto size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
          </a>
          <a href={MANAGER_LOGIN_HREF} className={PORTAL_LINK}>
            <Building2 aria-hidden="true" className="size-4 shrink-0 text-[#6c8b78]" strokeWidth={1.5} />Manager portal <ArrowUpRight aria-hidden className="ml-auto size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
          </a>
          </div>
        </nav>
    </div>
  );
}
