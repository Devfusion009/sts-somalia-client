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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BankTransferDetails,
  OfflineTopupForm,
  OnlineTopupForm,
  type BankTransfer,
  type Method,
} from "@/app/agent/(portal)/finance/top-up/top-up-forms";

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
          <Tabs value={rail} onValueChange={(value) => setRail(value as "online" | "offline")}>
            <TabsList className="w-full">
              <TabsTrigger value="online">Pay now</TabsTrigger>
              <TabsTrigger value="offline">I sent money</TabsTrigger>
            </TabsList>
            <TabsContent value="online" className="mt-4">
              <OnlineTopupForm methods={online} defaultAmount={amount} returnTo={returnTo} />
            </TabsContent>
            <TabsContent value="offline" className="mt-4 space-y-4">
              <BankTransferDetails bankTransfer={bankTransfer} />
              <OfflineTopupForm
                methods={offline}
                defaultAmount={amount}
                onSuccess={() => {
                  setOpen(false);
                  router.refresh();
                }}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <BankTransferDetails bankTransfer={bankTransfer} />
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
