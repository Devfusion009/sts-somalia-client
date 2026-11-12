"use client";

import { useState } from "react";
import { Clock3, Wallet, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BankTransferDetails,
  METHOD_ICONS,
  OfflineTopupForm,
  OnlineTopupForm,
  type BankTransfer,
  type Method,
} from "./top-up-forms";

const PRESETS = [100, 250, 500, 1000, 2500];
const usd = (value: number) => `USD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Rail = "online" | "offline";

/** Amount first, then how it is paid; the summary shows the wallet before and after. */
export function TopUpPanel({ balance, available, online, offline, bankTransfer }: {
  balance: number;
  available: number;
  online: Method[];
  offline: Method[];
  bankTransfer: BankTransfer;
}) {
  const [amount, setAmount] = useState("");
  const [rail, setRail] = useState<Rail>(online.length > 0 ? "online" : "offline");
  const methods = rail === "online" ? online : offline;
  const [methodByRail, setMethodByRail] = useState<Record<Rail, string>>({
    online: online[0]?.id ?? "",
    offline: offline[0]?.id ?? "",
  });
  const methodId = methodByRail[rail];
  const method = methods.find((item) => item.id === methodId) ?? methods[0];

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;
  const shown = valid ? value : 0;
  const controlled = { amount: valid ? value.toFixed(2) : "", method: method?.id ?? "", label: usd(shown) };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Add money" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary),black_40%),color-mix(in_oklch,var(--primary),black_10%))] p-5 text-primary-foreground sm:p-7">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 opacity-85"><Wallet className="size-4" aria-hidden="true" />Wallet balance</span>
            <span className="font-semibold tabular-nums">{usd(balance)}</span>
          </div>
          <label htmlFor="topup-amount" className="mt-6 block text-xs font-medium tracking-wide uppercase opacity-75">Enter amount</label>
          <div className="mt-2 flex items-baseline gap-3 border-b border-primary-foreground/25 pb-3 focus-within:border-primary-foreground">
            <span className="font-heading text-2xl font-semibold opacity-70">USD</span>
            <input
              id="topup-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              autoFocus
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full min-w-0 bg-transparent font-heading text-5xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-primary-foreground/40 [appearance:textfield] sm:text-6xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
            {PRESETS.map((preset) => {
              const active = valid && value === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAmount(String(preset))}
                  className={cn(
                    "min-h-9 rounded-full px-4 text-sm font-semibold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-foreground/50",
                    active ? "bg-primary-foreground text-primary" : "bg-primary-foreground/12 hover:bg-primary-foreground/20"
                  )}
                >
                  ${preset.toLocaleString("en-US")}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          {online.length > 0 ? (
            <div role="tablist" aria-label="Payment type" className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
              {([["online", "Pay online", Zap], ["offline", "Transfer or cash", Clock3]] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={rail === key}
                  onClick={() => setRail(key)}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    rail === key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          ) : null}

          <fieldset className="min-w-0">
            <legend className="mb-3 text-sm font-semibold">Pay with</legend>
            <div role="radiogroup" aria-label="Payment method" className="grid gap-2 sm:grid-cols-3">
              {methods.map((item) => {
                const selected = item.id === method?.id;
                const Icon = METHOD_ICONS[item.id] ?? Wallet;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMethodByRail((current) => ({ ...current, [rail]: item.id }))}
                    className={cn(
                      "flex min-h-20 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40 hover:bg-secondary/60"
                    )}
                  >
                    <span className={cn("flex size-8 items-center justify-center rounded-lg", selected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")} aria-hidden="true">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm font-semibold leading-tight">{item.label}</span>
                    {item.simulated || item.badges.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {item.simulated ? <Badge variant="warning">Simulated</Badge> : null}
                        {item.badges.map((badge) => <Badge key={badge} variant="neutral">{badge}</Badge>)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {rail === "offline" && method?.id === "bank_transfer" ? <BankTransferDetails bankTransfer={bankTransfer} /> : null}

          {rail === "online"
            ? <OnlineTopupForm key="online" methods={online} controlled={controlled} />
            : <OfflineTopupForm key="offline" methods={offline} controlled={controlled} />}
        </div>
      </section>

      <aside aria-label="Summary" className="rounded-2xl border border-border bg-card p-5 shadow-xs lg:sticky lg:top-24">
        <h2 className="font-heading text-base font-semibold">Summary</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold tabular-nums">{usd(shown)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Method</dt><dd className="truncate font-medium">{method?.label ?? "—"}</dd></div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Credited</dt>
            <dd>
              {rail === "online"
                ? <Badge variant="success"><Zap aria-hidden="true" />Instantly</Badge>
                : <Badge variant="warning"><Clock3 aria-hidden="true" />After STS review</Badge>}
            </dd>
          </div>
        </dl>
        <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Current balance</dt><dd className="tabular-nums">{usd(balance)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="font-semibold">New balance</dt><dd className="font-heading text-lg font-semibold text-primary tabular-nums">{usd(balance + shown)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Available to spend</dt><dd className="tabular-nums">{usd(available + shown)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}
