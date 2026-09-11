"use client";

import { useActionState, useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  CloudUpload,
  Copy,
  CreditCard,
  FileText,
  Landmark,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/auth/actions";
import { requestOfflineTopup, startOnlineTopup } from "@/modules/agencies/topup-actions";

export type Method = {
  id: string;
  label: string;
  description: string;
  badges: string[];
  requiresPhone: boolean;
  simulated: boolean;
};

export type BankTransfer = { bankName: string; accountName: string; accountNumber: string };

const PROOF_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const METHOD_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  bank_transfer: Landmark,
  cash_office: Banknote,
  card: CreditCard,
  evc_plus: Smartphone,
  zaad: Smartphone,
  sahal: Smartphone,
  edahab: Smartphone,
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
    <div className="grid gap-2">
      <input type="hidden" name={name} value={value} />
      {methods.map((method) => {
        const selected = value === method.id;
        const Icon = METHOD_ICONS[method.id] ?? Wallet;
        return (
          <button
            key={method.id}
            type="button"
            onClick={() => onChange(method.id)}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
              selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                selected ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">{method.label}</span>
                {method.simulated ? (
                  <span className="rounded bg-brand-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-gold">
                    Simulated
                  </span>
                ) : null}
                {method.badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {badge}
                  </span>
                ))}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{method.description}</span>
            </span>
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-primary" : "border-border"
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
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

export function BankTransferDetails({ bankTransfer }: { bankTransfer: BankTransfer }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-secondary/40">
      <CopyRow label="Bank" value={bankTransfer.bankName} />
      <CopyRow label="Account name" value={bankTransfer.accountName} />
      <CopyRow label="Account number" value={bankTransfer.accountNumber} mono />
    </div>
  );
}

function AmountField({ id, defaultValue }: { id: string; defaultValue?: number }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        Amount (USD) <span className="text-destructive">*</span>
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={defaultValue ? defaultValue.toFixed(2) : undefined}
          required
          className="pl-5"
        />
      </div>
    </div>
  );
}

function ReceiptField() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function applyFile(next: File | null) {
    setFile(next);
    if (!inputRef.current) return;
    if (next) {
      const transfer = new DataTransfer();
      transfer.items.add(next);
      inputRef.current.files = transfer.files;
    } else {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="offline-proof">
        Receipt <span className="text-destructive">*</span>
      </Label>
      <input
        ref={inputRef}
        id="offline-proof"
        name="proof"
        type="file"
        accept={PROOF_ACCEPT}
        required
        className="sr-only"
        onChange={(event) => applyFile(event.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{file.name}</p>
            <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => applyFile(null)}
            aria-label="Remove receipt"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) applyFile(dropped);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <CloudUpload className="size-5 text-muted-foreground" />
          <p className="text-xs font-medium">Drag and drop, or click to browse</p>
          <p className="text-[11px] text-muted-foreground">JPG, PNG, WebP, or PDF — up to 5MB</p>
        </div>
      )}
    </div>
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
}: {
  methods: Method[];
  defaultAmount?: number;
  onSuccess?: () => void;
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
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : submitted ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Sent to STS for confirmation.</AlertDescription>
        </Alert>
      ) : null}

      <MethodPicker methods={methods} value={method} onChange={setMethod} name="method" />

      <div className="grid gap-4 sm:grid-cols-2">
        <AmountField id="offline-amount" defaultValue={defaultAmount} />
        <div className="grid gap-2">
          <Label htmlFor="offline-reference">Reference</Label>
          <Input id="offline-reference" name="reference" placeholder="Transfer ref, transaction id, receipt no." />
        </div>
      </div>

      <ReceiptField />

      <div className="grid gap-2">
        <Label htmlFor="offline-note">Note</Label>
        <Textarea id="offline-note" name="note" rows={2} placeholder="Anything STS should know" />
      </div>

      <SubmitButton pendingText="Sending…">Send for confirmation</SubmitButton>
    </form>
  );
}

export function OnlineTopupForm({
  methods,
  defaultAmount,
  returnTo,
}: {
  methods: Method[];
  defaultAmount?: number;
  /** Portal path to land on once the wallet is credited (booking desk). */
  returnTo?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(startOnlineTopup, null);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const selected = methods.find((m) => m.id === methodId);
  const router = useRouter();

  useEffect(() => {
    if (state?.destination) {
      router.push(state.destination);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <MethodPicker methods={methods} value={methodId} onChange={setMethodId} name="method" />

      <div className="grid gap-4 sm:grid-cols-2">
        <AmountField id="online-amount" defaultValue={defaultAmount} />
        {selected?.requiresPhone ? (
          <div className="grid gap-2">
            <Label htmlFor="online-phone">
              Mobile number <span className="text-destructive">*</span>
            </Label>
            <Input id="online-phone" name="payerPhone" inputMode="tel" placeholder="+252…" required />
          </div>
        ) : null}
      </div>

      <SubmitButton pendingText="Starting…">Pay {selected ? `with ${selected.label}` : "now"}</SubmitButton>
    </form>
  );
}
