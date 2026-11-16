"use client";

import { useActionState, useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Landmark,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/auth/actions";
import { requestOfflineTopup, startOnlineTopup } from "@/modules/agencies/topup-actions";
import { FileField } from "@/components/ui/upload";

export type Method = {
  id: string;
  label: string;
  description: string;
  badges: string[];
  requiresPhone: boolean;
  simulated: boolean;
};

export type BankTransfer = { bankName: string; accountName: string; accountNumber: string };

/** Amount and method chosen outside the form (the Add money page's amount-first panel). */
export type ControlledTopup = { amount: string; method: string; label: string };

function ControlledFields({ controlled }: { controlled: ControlledTopup }) {
  return (
    <>
      <input type="hidden" name="amount" value={controlled.amount} />
      <input type="hidden" name="method" value={controlled.method} />
    </>
  );
}

const PROOF_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export const METHOD_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  bank_transfer: Landmark,
  cash_office: Banknote,
  card: CreditCard,
  evc_plus: Smartphone,
  zaad: Smartphone,
  sahal: Smartphone,
  edahab: Smartphone,
};

function MethodPicker({
  methods,
  value,
  onChange,
  name,
}: {
  methods: Method[];
  value: string;
  onChange: (id: string) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid gap-2">
      <input type="hidden" name={name} value={value} />
      {methods.map((method) => {
        const selected = value === method.id;
        const Icon = METHOD_ICONS[method.id] ?? Wallet;
        return (
          <button
            key={method.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(method.id)}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">{method.label}</span>
                {method.simulated ? <Badge variant="warning">Simulated</Badge> : null}
                {method.badges.map((badge) => (
                  <Badge key={badge} variant="neutral">
                    {badge}
                  </Badge>
                ))}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{method.description}</span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-primary" : "border-input"
              )}
            >
              {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-0.5 break-all text-sm font-medium", mono && "font-mono")}>{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label={`Copy ${label.toLowerCase()}`}
        title={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {copied ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      </button>
    </div>
  );
}

export function BankTransferDetails({ bankTransfer }: { bankTransfer: BankTransfer }) {
  return (
    <div className="divide-y divide-border rounded-lg bg-secondary/40">
      <CopyRow label="Bank" value={bankTransfer.bankName} />
      <CopyRow label="Account name" value={bankTransfer.accountName} />
      <CopyRow label="Account number" value={bankTransfer.accountNumber} mono />
    </div>
  );
}

function AmountField({ id, defaultValue }: { id: string; defaultValue?: number }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        Amount (USD) <span className="text-destructive">*</span>
      </FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          defaultValue={defaultValue ? defaultValue.toFixed(2) : undefined}
          required
          className="tabular-nums"
        />
      </InputGroup>
    </Field>
  );
}

function ReceiptField() {
  return (
    <Field>
      <FieldLabel htmlFor="offline-proof">
        Receipt <span className="text-destructive">*</span>
      </FieldLabel>
      <FileField id="offline-proof" name="proof" accept={PROOF_ACCEPT} maxBytes={5 * 1024 * 1024} required />
    </Field>
  );
}

/**
 * `defaultAmount` and `onSuccess` exist for the booking desk, which opens
 * this in a dialog with the shortfall already filled in and needs to know
 * when to close and re-read the balance. The Finance page passes neither.
 */
export function OfflineTopupForm({
  methods,
  defaultAmount,
  onSuccess,
  controlled,
}: {
  methods: Method[];
  defaultAmount?: number;
  onSuccess?: () => void;
  controlled?: ControlledTopup;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(requestOfflineTopup, null);
  const [method, setMethod] = useState(methods[0]?.id ?? "");
  const submitted = state !== null && !state.error;
  const notified = useRef(false);

  useEffect(() => {
    if (submitted && !notified.current) {
      notified.current = true;
      onSuccess?.();
    }
  }, [submitted, onSuccess]);

  return (
    <form action={formAction}>
      <FieldGroup className="gap-4">
        {submitted ? (
          <Alert>
            <CheckCircle2 />
            <AlertDescription>Sent to STS for confirmation.</AlertDescription>
          </Alert>
        ) : null}

        {controlled ? (
          <ControlledFields controlled={controlled} />
        ) : (
          <MethodPicker methods={methods} value={method} onChange={setMethod} name="method" />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {controlled ? null : <AmountField id="offline-amount" defaultValue={defaultAmount} />}
          <Field className={controlled ? "sm:col-span-2" : undefined}>
            <FieldLabel htmlFor="offline-reference">Reference</FieldLabel>
            <Input id="offline-reference" name="reference" placeholder="Transfer ref, transaction id, receipt no." />
          </Field>
        </div>

        <ReceiptField />

        <Field>
          <FieldLabel htmlFor="offline-note">Note</FieldLabel>
          <Textarea id="offline-note" name="note" rows={2} placeholder="Anything STS should know" />
        </Field>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <FieldError className="sm:mr-auto">{state?.error}</FieldError>
          <SubmitButton size={controlled ? "lg" : undefined} disabled={controlled ? !(Number(controlled.amount) > 0) : undefined} pendingText="Sending…" className={controlled ? "w-full" : "max-sm:w-full"}>
            {controlled && Number(controlled.amount) > 0 ? `Send ${controlled.label} for confirmation` : "Send for confirmation"}
          </SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}

export function OnlineTopupForm({
  methods,
  defaultAmount,
  returnTo,
  controlled,
}: {
  methods: Method[];
  defaultAmount?: number;
  /** Portal path to land on once the wallet is credited (booking desk). */
  returnTo?: string;
  controlled?: ControlledTopup;
}) {
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(async (previous, data) => {
    const fingerprint = JSON.stringify([data.get("amount"), data.get("method"), data.get("payerPhone")]);
    if (!attempt.current || attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    data.set("idempotencyKey", attempt.current.key);
    const result = await startOnlineTopup(previous, data);
    if (result?.paymentAttemptStatus === "failed") attempt.current = null;
    return result;
  }, null);
  const [ownMethodId, setMethodId] = useState(methods[0]?.id ?? "");
  const methodId = controlled?.method ?? ownMethodId;
  const selected = methods.find((m) => m.id === methodId);
  const router = useRouter();

  useEffect(() => {
    if (state?.destination) {
      router.push(state.destination);
    }
  }, [state, router]);

  return (
    <form action={formAction}>
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <FieldGroup className="gap-4">
        {controlled ? (
          <ControlledFields controlled={controlled} />
        ) : (
          <MethodPicker methods={methods} value={methodId} onChange={setMethodId} name="method" />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {controlled ? null : <AmountField id="online-amount" defaultValue={defaultAmount} />}
          {selected?.requiresPhone ? (
            <Field>
              <FieldLabel htmlFor="online-phone">
                Mobile number <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="online-phone" name="payerPhone" type="tel" inputMode="tel" placeholder="+252…" required />
            </Field>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <FieldError className="sm:mr-auto">{state?.error}</FieldError>
          <SubmitButton size={controlled ? "lg" : undefined} disabled={controlled ? !(Number(controlled.amount) > 0) : undefined} pendingText="Starting…" className={controlled ? "w-full" : "max-sm:w-full"}>
            {controlled && Number(controlled.amount) > 0 ? `Pay ${controlled.label}` : <>Pay {selected ? `with ${selected.label}` : "now"}</>}
          </SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
