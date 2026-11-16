"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronRight, Copy, Download, KeyRound, Plus, QrCode, ShieldCheck, ShieldPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  afterMfaFactorRemovedAction,
  completeMfaEnrollmentAction,
  regenerateRecoveryCodesAction,
} from "@/modules/auth/security-actions";

type EnrolledFactor = { id: string; friendly_name: string | null; created_at?: string | null };

/**
 * The browser Supabase MFA API, imported on first use. The admin layout
 * renders this component on its enrollment screen, so a static import put
 * supabase-js (~64 KB gzipped) on every admin page.
 */
async function mfaApi() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient().auth.mfa;
}

type Mode =
  | { kind: "idle" }
  | { kind: "enrolling"; factorId: string; qrCode: string; secret: string; name: string }
  | { kind: "codes"; codes: string[] };

const DEFAULT_NAME = "Authenticator app";

/** Supabase requires a unique name per factor: "Authenticator app", then "Authenticator app 2", … */
function nextFactorName(existing: Array<string | null>) {
  const taken = new Set(existing.map((n) => (n ?? DEFAULT_NAME).toLowerCase()));
  if (!taken.has(DEFAULT_NAME.toLowerCase())) return DEFAULT_NAME;
  for (let i = 2; i < 20; i += 1) {
    if (!taken.has(`${DEFAULT_NAME} ${i}`.toLowerCase())) return `${DEFAULT_NAME} ${i}`;
  }
  return `${DEFAULT_NAME} ${Date.now()}`;
}

function addedOn(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Two-factor authentication with authenticator apps (TOTP, Supabase Auth MFA)
 * and one-time recovery codes. Enrollment runs against the browser SDK
 * (enroll → scan → verify); the server then records the change, emails the
 * owner and issues recovery codes.
 */
export function MfaSettings({
  factors,
  recoveryCodesLeft = 0,
  dashboard = false,
}: {
  factors: EnrolledFactor[];
  /** Unused recovery codes on the account. */
  recoveryCodesLeft?: number | null;
  dashboard?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hasFactor = factors.length > 0 || mode.kind === "codes";

  function runTransition(task: () => Promise<void>) {
    startTransition(async () => {
      try { await task(); }
      catch { setError("Security settings could not be updated."); }
    });
  }

  function beginEnroll() {
    setError(null);
    runTransition(async () => {
      const mfa = await mfaApi();
      // A setup abandoned earlier leaves an unverified factor whose name would
      // block a new one with the same name.
      const { data: listed, error: listError } = await mfa.listFactors();
      if (listError) { setError("Authenticators could not be loaded."); return; }
      for (const stale of listed?.all.filter((f) => f.status === "unverified") ?? []) {
        await mfa.unenroll({ factorId: stale.id });
      }
      const name = nextFactorName(factors.map((f) => f.friendly_name));
      const { data, error: enrollError } = await mfa.enroll({ factorType: "totp", friendlyName: name });
      if (enrollError || !data) {
        setError(enrollError?.message ?? "Could not start setup.");
        return;
      }
      setCode("");
      setMode({ kind: "enrolling", factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, name });
    });
  }

  function cancelEnroll() {
    if (mode.kind !== "enrolling") return;
    const factorId = mode.factorId;
    setMode({ kind: "idle" });
    setCode("");
    setError(null);
    runTransition(async () => {
      const mfa = await mfaApi();
      await mfa.unenroll({ factorId });
    });
  }

  function confirmEnroll() {
    if (mode.kind !== "enrolling") return;
    const factorId = mode.factorId;
    setError(null);
    runTransition(async () => {
      const mfa = await mfaApi();
      const { data: challenge, error: challengeError } = await mfa.challenge({ factorId });
      if (challengeError || !challenge) {
        setError(challengeError?.message ?? "Verification failed.");
        return;
      }
      const { error: verifyError } = await mfa.verify({ factorId, challengeId: challenge.id, code });
      if (verifyError) {
        setError("Incorrect code.");
        return;
      }
      const result = await completeMfaEnrollmentAction();
      setCode("");
      if (result?.error) {
        setError(result.error);
        setMode({ kind: "idle" });
        router.refresh();
        return;
      }
      if (result?.codes) {
        setMode({ kind: "codes", codes: result.codes });
      } else {
        setMode({ kind: "idle" });
        toast.success("Authenticator added.", { position: "top-center" });
        router.refresh();
      }
    });
  }

  function removeFactor(factorId: string) {
    setError(null);
    runTransition(async () => {
      const mfa = await mfaApi();
      const { error: unenrollError } = await mfa.unenroll({ factorId });
      if (unenrollError) {
        setError(unenrollError.message);
        return;
      }
      await afterMfaFactorRemovedAction();
      toast.success("Authenticator removed.", { position: "top-center" });
      router.refresh();
    });
  }

  function regenerateCodes() {
    setError(null);
    runTransition(async () => {
      const result = await regenerateRecoveryCodesAction();
      if (result?.error) setError(result.error);
      else if (result?.codes) setMode({ kind: "codes", codes: result.codes });
    });
  }

  function copyCodes(codes: string[]) {
    void navigator.clipboard
      .writeText(codes.join("\n"))
      .then(() => toast.success("Recovery codes copied.", { position: "top-center" }))
      .catch(() => toast.error("Could not copy.", { position: "top-center" }));
  }

  function downloadCodes(codes: string[]) {
    const blob = new Blob([`STS Somalia recovery codes\n\n${codes.join("\n")}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sts-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card id={dashboard ? "two-factor" : undefined} className="scroll-mt-20">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-3">
          {dashboard ? <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="size-5" aria-hidden /></span> : null}
          Two-factor authentication
        </CardTitle>
        <CardAction>
          <Badge variant={hasFactor ? "success" : "neutral"}>{dashboard ? hasFactor ? "Enabled" : "Not enabled" : hasFactor ? "On" : "Off"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {mode.kind === "codes" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold">Save your recovery codes</p>
            </div>
            <ul className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-4 font-mono text-sm tabular-nums">
              {mode.codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => copyCodes(mode.codes)}>
                <Copy data-icon="inline-start" aria-hidden="true" /> Copy
              </Button>
              <Button type="button" variant="outline" onClick={() => downloadCodes(mode.codes)}>
                <Download data-icon="inline-start" aria-hidden="true" /> Download
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setMode({ kind: "idle" });
                  router.refresh();
                }}
              >
                I&apos;ve saved them
              </Button>
            </div>
          </div>
        ) : mode.kind === "enrolling" ? (
          <FieldGroup className="gap-4">
            <div className="flex justify-center rounded-lg bg-white p-4 ring-1 ring-foreground/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(mode.qrCode)}`}
                alt="Authenticator QR code"
                width={180}
                height={180}
              />
            </div>
            <Field>
              <FieldLabel htmlFor="mfa-secret">Setup key</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="mfa-secret"
                  readOnly
                  value={mode.secret}
                  className="font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy setup key"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(mode.secret)
                      .then(() => toast.success("Setup key copied.", { position: "top-center" }))
                  }
                >
                  <Copy aria-hidden="true" />
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="mfa-code">6-digit code</FieldLabel>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6) {
                    e.preventDefault();
                    confirmEnroll();
                  }
                }}
                className="h-10 text-center text-lg tracking-[0.5em] tabular-nums"
                placeholder="000000"
                autoFocus
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={pending} onClick={cancelEnroll}>
                Cancel
              </Button>
              <Button onClick={confirmEnroll} loading={pending} disabled={code.length !== 6}>
                Confirm
              </Button>
            </div>
          </FieldGroup>
        ) : hasFactor ? (
          <div className="space-y-4">
            <ul className={dashboard ? "space-y-3" : "-my-2 divide-y divide-border"}>
              {factors.map((f) => (
                <li key={f.id} className={`flex flex-wrap items-center justify-between gap-3 ${dashboard ? "rounded-xl border p-4" : "py-2.5"}`}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{f.friendly_name ?? DEFAULT_NAME}</span>
                      {addedOn(f.created_at) ? (
                        <span className="block text-xs text-muted-foreground">Added {addedOn(f.created_at)}</span>
                      ) : null}
                    </span>
                  </span>
                  <ConfirmButton
                    title={factors.length === 1 ? "Turn off two-factor authentication?" : "Remove this authenticator?"}
                    confirmLabel="Remove"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onConfirm={() => removeFactor(f.id)}
                    disabled={pending}
                  >
                    <Trash2 aria-hidden="true" /> Remove
                  </ConfirmButton>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
                Recovery codes
                <Badge variant={recoveryCodesLeft == null ? "neutral" : recoveryCodesLeft > 2 ? "neutral" : "warning"} className="tabular-nums">
                  {recoveryCodesLeft == null ? "Unavailable" : `${recoveryCodesLeft} left`}
                </Badge>
              </span>
              <ConfirmButton
                title="Replace your recovery codes?"
                confirmLabel="Generate new codes"
                icon="x"
                variant="ghost"
                size="sm"
                onConfirm={regenerateCodes}
                disabled={pending}
              >
                Generate new codes
              </ConfirmButton>
            </div>

            <Button variant="outline" onClick={beginEnroll} loading={pending} className="w-full">
              {pending ? null : <Plus aria-hidden="true" />} Add another authenticator
            </Button>
          </div>
        ) : (
          dashboard ? <div className="space-y-3">
            <Button variant="outline" className="h-auto w-full justify-between gap-3 rounded-xl p-4 text-left" onClick={beginEnroll} loading={pending}>
              <span className="flex items-center gap-3"><QrCode className="size-5 shrink-0 text-primary" aria-hidden /><span>Set up authenticator app</span></span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
              <span className="flex items-center gap-3 text-sm font-medium"><KeyRound className="size-5 text-muted-foreground" aria-hidden />Recovery codes</span>
              <Badge variant="neutral">Not available</Badge>
            </div>
          </div> : <Button onClick={beginEnroll} loading={pending}>
            {pending ? null : <ShieldPlus aria-hidden="true" />} Add authenticator app
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
