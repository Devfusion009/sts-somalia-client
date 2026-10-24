"use client";

import { useActionState, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, ExternalLink, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { cn } from "@/lib/utils";
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

const PHASE_STYLE: Record<Phase, { label: string; variant: BadgeVariant }> = {
  live: { label: "Live", variant: "success" },
  configured: { label: "Inactive", variant: "warning" },
  absent: { label: "Not connected", variant: "neutral" },
};

export function IntegrationCard({ status }: { status: IntegrationStatus }) {
  const { provider } = status;
  const [saveState, saveAction] = useActionState(saveIntegrationCredentials, null);
  const [isActive, setIsActive] = useState(status.isActive);
  const [pending, startTransition] = useTransition();
  const [testing, startTest] = useTransition();
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
    startTest(async () => {
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
    <Card className={cn(phase === "live" && "ring-primary/30")}>
      <CardContent className="space-y-5">
        {/* Identity + state. The toggle sits with the status pill rather than
            floating alone, so "what is this doing right now" reads as one unit. */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-base font-semibold">{provider.name}</h3>
              <Badge variant={phaseStyle.variant}>{phaseStyle.label}</Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {provider.selfServe ? "Self-serve" : "Requires approval"}
              </Badge>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${provider.name} docs and signup`}
              title="Docs & signup"
              render={<a href={provider.docsUrl} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink />
            </Button>
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
            role="status"
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm",
              testResult.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            )}
          >
            {testResult.ok ? (
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 break-words">{testResult.message}</span>
            {status.lastTestedAt ? (
              <span className="ml-auto shrink-0 text-xs opacity-80">
                {formatDistanceToNow(new Date(status.lastTestedAt), { addSuffix: true })}
              </span>
            ) : null}
          </div>
        ) : null}

        <form action={saveAction} className="space-y-4">
          <input type="hidden" name="providerKey" value={provider.key} />
          <FieldSet className="max-w-3xl gap-3">
            <FieldLegend variant="label" className="flex items-center gap-2">
              Credentials
              {status.hasCredentials ? <Badge variant="success">Saved</Badge> : null}
            </FieldLegend>
            <div className="grid gap-4 sm:grid-cols-2">
              {provider.credentialFields.map((field) => (
                <Field key={field.key}>
                  <FieldLabel htmlFor={`${provider.key}-${field.key}`} className="font-normal text-muted-foreground">
                    {field.label}
                  </FieldLabel>
                  <PasswordInput
                    id={`${provider.key}-${field.key}`}
                    name={field.key}
                    placeholder={status.hasCredentials ? "Saved — enter to replace" : field.placeholder}
                    autoComplete="off"
                  />
                </Field>
              ))}
            </div>
          </FieldSet>

          {saveState?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {saveState.error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            {status.hasCredentials ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="mr-auto text-destructive hover:text-destructive"
                      aria-label={`Remove ${provider.name} credentials`}
                      title="Remove credentials"
                    />
                  }
                >
                  <Trash2 />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {provider.name} credentials?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The integration is deactivated and the stored credentials are deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={removeCredentials}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={testing}
              disabled={!status.hasCredentials || pending}
              onClick={runTest}
            >
              Test connection
            </Button>
            <SubmitButton size="sm" pendingText="Saving…">
              {status.hasCredentials ? "Replace credentials" : "Save credentials"}
            </SubmitButton>
          </div>
        </form>

        {provider.key === "custom" ? <CustomPartnerConfigForm config={status.config} /> : null}
      </CardContent>
    </Card>
  );
}
