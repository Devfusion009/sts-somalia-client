"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldPlus, AlertCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmButton } from "@/components/ui/confirm-button";

type EnrolledFactor = { id: string; friendly_name: string | null };

/**
 * The browser Supabase MFA API, imported on first use. The admin layout
 * renders this component on its enrollment screen, so a static import put
 * supabase-js (~64 KB gzipped) on every admin page.
 */
async function mfaApi() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient().auth.mfa;
}

type EnrollState = {
  factorId: string;
  qrCode: string;
  secret: string;
} | null;

/**
 * Client component because enrollment is a multi-step interactive flow
 * (enroll → show QR → challenge → verify) against the browser Supabase SDK —
 * auth.mfa.enroll() returns the QR/secret directly, no round trip through a
 * server action needed until the final verify step (which also runs
 * client-side here for the same reason: it needs the freshly-issued
 * factorId from enroll(), not a re-fetched one).
 */
export function MfaSettings({ factors }: { factors: EnrolledFactor[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enrolling, setEnrolling] = useState<EnrollState>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hasFactor = factors.length > 0;

  function beginEnroll() {
    setError(null);
    startTransition(async () => {
      const mfa = await mfaApi();
      const { data, error: enrollError } = await mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });
      if (enrollError || !data) {
        setError(enrollError?.message ?? "Could not start enrollment.");
        return;
      }
      setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    });
  }

  function confirmEnroll() {
    if (!enrolling) return;
    setError(null);
    startTransition(async () => {
      const mfa = await mfaApi();
      const { data: challenge, error: challengeError } = await mfa.challenge({
        factorId: enrolling.factorId,
      });
      if (challengeError || !challenge) {
        setError(challengeError?.message ?? "Verification failed.");
        return;
      }
      const { error: verifyError } = await mfa.verify({
        factorId: enrolling.factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        setError("Incorrect code.");
        return;
      }
      setEnrolling(null);
      setCode("");
      router.refresh();
    });
  }

  function removeFactor(factorId: string) {
    setError(null);
    startTransition(async () => {
      const mfa = await mfaApi();
      const { error: unenrollError } = await mfa.unenroll({ factorId });
      if (unenrollError) {
        setError(unenrollError.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardAction>
          <Badge variant={hasFactor ? "success" : "neutral"}>{hasFactor ? "On" : "Off"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {enrolling ? (
          <FieldGroup className="gap-4">
            <div className="flex justify-center rounded-lg bg-white p-4 ring-1 ring-foreground/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(enrolling.qrCode)}`}
                alt="Authenticator QR code"
                width={180}
                height={180}
              />
            </div>
            <Field>
              <FieldLabel htmlFor="mfa-secret">Setup key</FieldLabel>
              <Input id="mfa-secret" readOnly value={enrolling.secret} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            </Field>
            <Field>
              <FieldLabel htmlFor="mfa-code">6-digit code</FieldLabel>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-10 text-center text-lg tracking-[0.5em] tabular-nums"
                placeholder="000000"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setEnrolling(null);
                  setCode("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={confirmEnroll} loading={pending} disabled={code.length !== 6}>
                Confirm
              </Button>
            </div>
          </FieldGroup>
        ) : hasFactor ? (
          <ul className="-my-2 divide-y divide-border">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">{f.friendly_name ?? "Authenticator App"}</span>
                </span>
                <ConfirmButton
                  title="Remove this authenticator?"
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
        ) : (
          <Button onClick={beginEnroll} loading={pending}>
            {pending ? null : <ShieldPlus aria-hidden="true" />} Add authenticator app
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
