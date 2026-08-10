"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldPlus, AlertCircle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type EnrolledFactor = { id: string; friendly_name: string | null };

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
  const supabase = createClient();
  const [pending, startTransition] = useTransition();
  const [enrolling, setEnrolling] = useState<EnrollState>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hasFactor = factors.length > 0;

  function beginEnroll() {
    setError(null);
    startTransition(async () => {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
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
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrolling.factorId,
      });
      if (challengeError || !challenge) {
        setError(challengeError?.message ?? "Could not verify — try again.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        setError("That code didn't match — check the time on your device and try again.");
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
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
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
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-primary" /> Two-Factor Authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {enrolling ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this with Google Authenticator, Authy, or any TOTP app, then enter the 6-digit
              code it shows.
            </p>
            <div className="flex justify-center rounded-lg border border-border bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(enrolling.qrCode)}`}
                alt="Scan with your authenticator app"
                width={180}
                height={180}
              />
            </div>
            <p className="text-center font-mono text-xs text-muted-foreground">
              Can&apos;t scan? Enter manually: {enrolling.secret}
            </p>
            <div className="space-y-2">
              <Label htmlFor="mfa-code">6-digit code</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-lg tracking-[0.5em]"
                placeholder="000000"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEnrolling(null);
                  setCode("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={confirmEnroll} disabled={pending || code.length !== 6}>
                {pending ? "Verifying…" : "Confirm"}
              </Button>
            </div>
          </div>
        ) : hasFactor ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              An authenticator app is protecting this account — you&apos;ll be asked for a code
              each time you sign in.
            </p>
            {factors.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm font-medium">{f.friendly_name ?? "Authenticator App"}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => removeFactor(f.id)}
                  disabled={pending}
                >
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add an authenticator app for an extra layer of security beyond your password —
              recommended for agency and admin accounts.
            </p>
            <Button onClick={beginEnroll} disabled={pending} className="gap-1.5">
              <ShieldPlus className="size-4" /> Add authenticator app
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
