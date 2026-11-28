"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { ArrowUpRight, Check, ChevronDown, FlaskConical, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { prepareWaafiPayments, saveIntegrationCredentials, setIntegrationActive } from "@/modules/admin/integrations/actions";
import type { IntegrationStatus } from "@/modules/admin/integrations/queries";

function SetupStep({ number, title, done, children }: { number: number; title: string; done: boolean; children: ReactNode }) {
  return <section className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
    <span className={cn("flex size-8 items-center justify-center rounded-full border text-sm font-semibold", done ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground")}>
      {done ? <Check className="size-4" aria-label="Complete" /> : number}
    </span>
    <div className="min-w-0 space-y-4 pt-1"><h4 className="font-semibold">{title}</h4>{children}</div>
  </section>;
}

export function WaafiSetupCard({ status }: { status: IntegrationStatus }) {
  const setup = status.waafi;
  const live = setup?.environment === "production";
  const mode = live ? "Live payments" : "QA sandbox payments";
  const ready = !!setup?.setupVerified && !!setup.hasWebhookSecret && status.fieldValues.environment === setup.environment;
  const [saveState, saveAction, saving] = useActionState(saveIntegrationCredentials, null);
  const [pending, startTransition] = useTransition();
  const [operation, setOperation] = useState<"verify" | "activate" | "pause" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const busy = saving || pending;

  function verifySetup() {
    setOperation("verify");
    startTransition(async () => {
      try { setResult(await prepareWaafiPayments(setup?.revision ?? "")); }
      catch { setResult({ ok: false, message: "Setup verification is unavailable. Try again." }); }
      finally { setOperation(null); }
    });
  }
  function changeActive(active: boolean) {
    setOperation(active ? "activate" : "pause");
    startTransition(async () => {
      try {
        const response = await setIntegrationActive("waafi", active, setup?.revision);
        setResult({ ok: !response.error, message: response.error ?? (active ? `${mode} activated.` : "New WaafiPay payments paused.") });
      } catch { setResult({ ok: false, message: "Payment status could not be changed. Reload to check its status." }); }
      finally { setOperation(null); }
    });
  }

  return <Card id="waafi-setup" className="scroll-mt-6 overflow-hidden rounded-xl py-0 xl:col-span-2">
    <CardContent className="space-y-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wallet className="size-5" aria-hidden /></span>
          <div className="space-y-1.5">
            <h3 className="font-heading text-lg font-semibold">WaafiPay</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant={status.isActive ? "success" : "neutral"}>{status.isActive ? mode : "Payments off"}</Badge>
              <Badge variant="outline">{live ? "Production" : "Sandbox"}</Badge>
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" render={<a href="https://waafipay.com/contact" target="_blank" rel="noreferrer" />}>
          Get live credentials <ArrowUpRight className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Supported wallets">
        {status.provider.capabilities?.map(capability => <Badge key={capability} variant="outline">{capability}</Badge>)}
      </div>

      {result && <div role="status" className={cn("rounded-lg px-3 py-2.5 text-sm", result.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>{result.message}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <SetupStep number={1} title={live ? "Save live merchant credentials" : "Save sandbox merchant credentials"} done={status.hasCredentials}>
          {status.hasCredentials && <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Merchant UID</dt><dd className="mt-1 font-medium break-all">{setup?.merchantUid || "Unavailable"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Store ID</dt><dd className="mt-1 font-medium break-all">{setup?.storeId || "Unavailable"}</dd></div>
          </dl>}
          <details className="group/waafi" open={!status.hasCredentials}>
            <summary className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {status.hasCredentials ? "Replace credentials" : "Merchant credentials"}<ChevronDown className="size-4 transition-transform group-open/waafi:rotate-180" aria-hidden />
            </summary>
            <form action={saveAction} autoComplete="off" className="space-y-4 pt-4" key={setup?.revision || "empty"}>
              <input type="hidden" name="providerKey" value="waafi" />
              <input type="hidden" name="environment" value={setup?.environment ?? "sandbox"} />
              <fieldset disabled={busy || status.isActive} className="grid gap-4 sm:grid-cols-2">
                {status.provider.credentialFields.filter(field => !["environment", "webhook_secret"].includes(field.key)).map(field => <div className="space-y-2" key={field.key}>
                  <Label htmlFor={`waafi-live-${field.key}`}>{field.label}</Label>
                  {field.plain ? <Input id={`waafi-live-${field.key}`} name={field.key} autoComplete="off" required maxLength={200} /> :
                    <PasswordInput id={`waafi-live-${field.key}`} name={field.key} autoComplete="new-password" data-1p-ignore data-lpignore="true" required maxLength={200} />}
                </div>)}
                <details className="sm:col-span-2">
                  <summary className="min-h-9 cursor-pointer text-sm text-muted-foreground">Existing notification signing key</summary>
                  <div className="space-y-2 pt-2"><Label htmlFor="waafi-signing-key">Webhook signing secret (optional)</Label>
                    <PasswordInput id="waafi-signing-key" name="webhook_secret" autoComplete="new-password" data-1p-ignore data-lpignore="true" maxLength={500} />
                  </div>
                </details>
              </fieldset>
              {saveState?.error && <div role="alert" className="text-sm text-destructive">{saveState.error}</div>}
              {saveState && !saveState.error && !result && <div role="status" className="text-sm text-primary">Credentials saved. Verify setup next.</div>}
              <Button type="submit" size="sm" loading={saving} disabled={busy || status.isActive}>{saving ? "Saving credentials…" : "Save credentials"}</Button>
            </form>
          </details>
        </SetupStep>

        <div className="space-y-6 border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        <SetupStep number={2} title="Verify setup" done={ready}>
          <div className="flex flex-wrap gap-2">
            <Badge variant={ready ? "success" : "neutral"}>Merchant connection {ready ? "verified" : "unchecked"}</Badge>
            <Badge variant={setup?.hasWebhookSecret ? "success" : "neutral"}>Payment notifications {setup?.hasWebhookSecret ? "key saved" : "not set up"}</Badge>
            <Badge variant={ready ? "success" : "neutral"}>Payment service {ready ? "verified" : "unchecked"}</Badge>
          </div>
          <Button type="button" size="sm" variant="outline" loading={operation === "verify"} disabled={busy || !status.hasCredentials || status.isActive} onClick={verifySetup}>
            <ShieldCheck className="size-4" aria-hidden /> {operation === "verify" ? "Checking setup…" : ready ? "Verify again" : "Verify and set up notifications"}
          </Button>
        </SetupStep>

        <div className="ml-4 border-t" />
        <SetupStep number={3} title={live ? "Activate live payments" : "Activate QA sandbox payments"} done={status.isActive}>
          {status.isActive ? <Button type="button" size="sm" variant="outline" loading={operation === "pause"} disabled={busy} onClick={() => changeActive(false)}>Pause new payments</Button> :
            <AlertDialog>
              <AlertDialogTrigger render={<Button type="button" size="sm" disabled={busy || !ready} loading={operation === "activate"} />}>{live ? "Activate live payments" : "Activate sandbox payments"}</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{live ? "Activate live WaafiPay payments?" : "Activate sandbox checkout on QA?"}</AlertDialogTitle>
                  <AlertDialogDescription className="sr-only">Confirm the payment merchant</AlertDialogDescription>
                </AlertDialogHeader>
                <dl className="grid gap-3 text-sm">
                  <div><dt className="text-muted-foreground">Environment</dt><dd className="font-medium">{live ? "Production · real payments" : "QA · sandbox payments"}</dd></div>
                  <div><dt className="text-muted-foreground">Merchant UID</dt><dd className="font-medium break-all">{setup?.merchantUid}</dd></div>
                  <div><dt className="text-muted-foreground">Store ID</dt><dd className="font-medium break-all">{setup?.storeId}</dd></div>
                </dl>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => changeActive(true)}>Activate payments</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>}
        </SetupStep>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="outline" size="sm" render={<Link href="/admin/finance/payments/sandbox" />}><FlaskConical className="size-4 text-amber-700" aria-hidden /> Sandbox test desk</Button>
        <span className="text-xs text-muted-foreground">{live ? "Live gateway · api.waafipay.net" : "Test gateway · sandbox.waafipay.com"}</span>
      </div>
    </CardContent>
  </Card>;
}
