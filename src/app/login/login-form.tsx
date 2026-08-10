"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Briefcase, Globe2, Headset, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signInAction } from "@/lib/auth/actions";
import { portalLoginHref } from "@/lib/subdomain";

const AGENT_LOGIN_HREF = portalLoginHref("agent");

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: "Secure by design",
    description: "Every booking is protected with encrypted payments and verified partners.",
  },
  {
    icon: Headset,
    title: "Real human support",
    description: "A Mogadishu-based team is one call away, before and after you travel.",
  },
  {
    icon: Wallet,
    title: "Transparent pricing",
    description: "No hidden fees — the price you see at search is the price you pay.",
  },
  {
    icon: Globe2,
    title: "Local & international",
    description: "Domestic Somali routes and international journeys, one platform.",
  },
];

/**
 * Personal (B2C) vs Business (B2B agent) account chooser.
 *
 * Only the Personal tab takes credentials. The Business tab used to host a
 * second agent sign-in form posting signInToAgentPortalAction from THIS origin,
 * which cannot work now that portal sessions are host-only: the cookie landed
 * on the public host, and the Agent Portal it redirected to couldn't read it,
 * so agents were bounced straight back to the portal's own login — two login
 * pages for one portal. The tab is now a signpost to that single page
 * (portalLoginHref), which is where the credentials belong.
 *
 * Admin deliberately has no tab at all: that portal stays reachable only via
 * the dedicated, unlinked /admin/login.
 */
export function LoginForm({ redirectTo, notice }: { redirectTo?: string; notice?: string }) {
  const [personalState, personalAction] = useActionState(signInAction, null);

  return (
    <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl shadow-xl lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Welcome back to STS Somalia</h2>
          <p className="mt-2 text-sm text-primary-foreground/80">
            Flights, hotels, visas, and Umrah packages — booked with confidence.
          </p>
        </div>
        <ul className="space-y-6">
          {VALUE_PROPS.map((v) => (
            <li key={v.title} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                <v.icon className="size-4.5" />
              </span>
              <div>
                <p className="font-medium">{v.title}</p>
                <p className="text-sm text-primary-foreground/70">{v.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-primary-foreground/60">Scout Travel Solution</p>
      </div>

      <Card className="rounded-none border-0 shadow-none">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Log in</CardTitle>
          <CardDescription>Choose the account you want to sign in to.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="personal">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal">Personal Account</TabsTrigger>
              <TabsTrigger value="business">Business Account</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="pt-4">
              {notice ? (
                <Alert className="mb-4">
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              ) : null}
              {personalState?.error ? (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle />
                  <AlertDescription>{personalState.error}</AlertDescription>
                </Alert>
              ) : null}
              <form action={personalAction} className="space-y-4">
                {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput id="password" name="password" autoComplete="current-password" required />
                </div>
                <SubmitButton className="w-full" pendingText="Logging in…">
                  Log in
                </SubmitButton>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </TabsContent>

            <TabsContent value="business" className="pt-4">
              <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="size-4 shrink-0 text-primary" />
                For approved travel agencies booking at B2B rates.
              </p>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-sm font-medium">Agency sign-in has its own page</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The Agent Portal signs you in on its own secure address. You&apos;ll land
                  straight on your bookings, wallet balance, and commission.
                </p>
              </div>
              {/* A real <a>, not <Link>: the Agent Portal is a separate origin
                  once subdomains are configured, which a client-side route push
                  cannot cross. */}
              <Button className="mt-4 w-full" render={<a href={AGENT_LOGIN_HREF} />}>
                Continue to Agent Portal
                <ArrowRight className="size-4" />
              </Button>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                New to STS Somalia Business?{" "}
                <Link href="/agents" className="font-medium text-primary hover:underline">
                  Apply to become an agent
                </Link>
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
