"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  OfflineTopupForm,
  OnlineTopupForm,
  type Method,
} from "@/app/agent/(portal)/finance/top-up/top-up-forms";

type BankTransfer = { bankName: string; accountName: string; accountNumber: string };

/**
 * The top-up flow at the point it's needed: opened from a booking the wallet
 * can't cover, with the shortfall already in the amount field. Same two
 * rails as Finance → Add money — a gateway that settles now, or a transfer
 * STS confirms — so nothing about how money enters the wallet is duplicated
 * here; only where the agent is standing when they do it.
 */
export function FundWalletDialog({
  amount,
  currency,
  returnTo,
  offline,
  online,
  bankTransfer,
}: {
  amount: number;
  currency: string;
  returnTo: string;
  offline: Method[];
  online: Method[];
  bankTransfer: BankTransfer;
}) {
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState<"online" | "offline">(online.length > 0 ? "online" : "offline");
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Wallet className="size-4" /> Add {currency} {amount.toFixed(0)}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add money</DialogTitle>
        </DialogHeader>

        {online.length > 0 ? (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary/60 p-1">
            {(
              [
                ["online", "Pay now"],
                ["offline", "I sent money"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRail(key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  rail === key
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {rail === "online" && online.length > 0 ? (
          <OnlineTopupForm methods={online} defaultAmount={amount} returnTo={returnTo} />
        ) : (
          <div className="space-y-4">
            <dl className="grid gap-1.5 rounded-lg bg-secondary/50 px-3 py-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Bank</dt>
                <dd className="font-medium">{bankTransfer.bankName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Account name</dt>
                <dd className="truncate font-medium">{bankTransfer.accountName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Account number</dt>
                <dd className="font-mono font-medium">{bankTransfer.accountNumber}</dd>
              </div>
            </dl>
            <OfflineTopupForm
              methods={offline}
              defaultAmount={amount}
              onSuccess={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
