"use client";

import { useActionState, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, ExternalLink, Loader2, Trash2, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { IntegrationStatus } from "@/modules/admin/integrations/queries";
import {
  saveIntegrationCredentials,
  setIntegrationActive,
  deleteIntegrationCredentials,
  testIntegrationConnection,
} from "@/modules/admin/integrations/actions";
import { CustomPartnerConfigForm } from "./custom-partner-config-form";

/**
 * The card's headline state. Derived rather than stored: "live" is the
 * conjunction of having credentials AND being switched on, and those two are
 * separate columns — showing only the toggle (as this card used to) left an
 * admin unable to tell "off" from "never configured" without clicking into the
 * fields.
 */
type Phase = "live" | "configured" | "absent";

const PHASE_STYLE: Record<Phase, { label: string; pill: string; dot: string }> = {
  live: {
    label: "Live",
    pill: "border-primary/30 bg-primary/5 text-primary",
    dot: "bg-primary",
  },
  configured: {
    label: "Inactive",
    pill: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-500",
    dot: "bg-amber-500",
  },
  absent: {
    label: "Not connected",
    pill: "border-border bg-muted/50 text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
};

export function IntegrationCard({ status }: { status: IntegrationStatus }) {
  const { provider } = status;
  const [saveState, saveAction] = useActionState(saveIntegrationCredentials, null);
  const [isActive, setIsActive] = useState(status.isActive);
  const [pending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(
    status.lastTestOk === null ? null : { ok: status.lastTestOk, message: status.lastTestMessage ?? "" }
  );

  const phase: Phase = !status.hasCredentials ? "absent" : isActive ? "live" : "configured";
  const phaseStyle = PHASE_STYLE[phase];

  function toggleActive(next: boolean) {
    setIsActive(next);
    startTransition(async () => {
      await setIntegrationActive(provider.key, next);
    });
  }

  function runTest() {
    startTransition(async () => {
      const result = await testIntegrationConnection(provider.key);
      setTestResult(result);
    });
  }

  function removeCredentials() {
    setIsActive(false);
    setTestResult(null);
    startTransition(async () => {
      await deleteIntegrationCredentials(provider.key);
    });
  }

  return (
    <Card className={phase === "live" ? "border-primary/30" : undefined}>
      <CardContent className="space-y-5 p-5">
        {/* Identity + state. The toggle sits with the status pill rather than
            floating alone, so "what is this doing right now" reads as one unit. */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-base font-semibold">{provider.name}</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${phaseStyle.pill}`}
              >
                <span className={`size-1.5 rounded-full ${phaseStyle.dot}`} />
                {phaseStyle.label}
              </span>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {provider.selfServe ? "Self-serve" : "Requires approval"}
              </Badge>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <Label htmlFor={`active-${provider.key}`} className="text-sm font-medium">
              Active
            </Label>
            <Switch
              id={`active-${provider.key}`}
              checked={isActive}
              disabled={!status.hasCredentials || pending}
              onCheckedChange={toggleActive}
            />
          </div>
        </div>

        {provider.approvalNote ? (
          <Alert>
            <AlertDescription>{provider.approvalNote}</AlertDescription>
          </Alert>
        ) : null}

        {testResult ? (
          <div
            className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              testResult.ok
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <XCircle className="size-4 shrink-0" />
            )}
            <span className="min-w-0">{testResult.message}</span>
            {status.lastTestedAt ? (
              <span className="ml-auto shrink-0 text-xs opacity-70">
                {formatDistanceToNow(new Date(status.lastTestedAt), { addSuffix: true })}
              </span>
            ) : null}
          </div>
        ) : null}

        <form action={saveAction} className="space-y-4">
          <input type="hidden" name="providerKey" value={provider.key} />
          {saveState?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{saveState.error}</AlertDescription>
            </Alert>
          ) : null}

          {/* Capped, not full-bleed: a single-field provider in a full-width
              panel reads as a mostly-empty box on a wide admin viewport. */}
          <div className="max-w-3xl rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <KeyRound className="size-3.5" />
              Credentials
              {status.hasCredentials ? (
                <span className="text-primary">· saved &amp; encrypted</span>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {provider.credentialFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`${provider.key}-${field.key}`} className="text-sm">
                    {field.label}
                  </Label>
                  <PasswordInput
                    id={`${provider.key}-${field.key}`}
                    name={field.key}
                    placeholder={status.hasCredentials ? "Saved — enter to replace" : field.placeholder}
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <SubmitButton size="sm" pendingText="Saving…">
              {status.hasCredentials ? "Replace credentials" : "Save credentials"}
            </SubmitButton>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!status.hasCredentials || pending}
              onClick={runTest}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Test connection
            </Button>
            {status.hasCredentials ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button type="button" size="sm" variant="ghost" className="gap-1.5 text-destructive" />}
                >
                  <Trash2 className="size-3.5" /> Remove
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {provider.name} credentials?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deactivates the integration and permanently deletes the stored API
                      credentials. You&apos;ll need to re-enter them to use {provider.name} again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={removeCredentials}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Docs &amp; signup <ExternalLink className="size-3" />
            </a>
          </div>
        </form>

        {provider.key === "custom" ? <CustomPartnerConfigForm config={status.config} /> : null}
      </CardContent>
    </Card>
  );
}
