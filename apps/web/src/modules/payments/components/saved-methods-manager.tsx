"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Smartphone, Star, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";
import { SAVABLE_WALLETS, WALLET_LABELS, maskMsisdn } from "../saved-methods";
import type { Database } from "@/lib/types/database.types";
import type { SaveWalletMethodInput } from "@sts/shared-types";

type SavedPaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

const WALLET_ITEMS = SAVABLE_WALLETS.map((w) => ({ value: w.id, label: w.label }));

export function SavedMethodsManager({ methods }: { methods: SavedPaymentMethod[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SavedPaymentMethod | null | "new">(null);
  const [confirmDelete, setConfirmDelete] = useState<SavedPaymentMethod | null>(null);

  const saveMethod = trpc.payments.account.saveWalletMethod.useMutation({
    onSuccess: (result) => {
      if (result.error) return;
      setEditing(null);
      router.refresh();
    },
  });
  const deleteMethod = trpc.payments.account.deleteWalletMethod.useMutation({
    onSuccess: () => {
      setConfirmDelete(null);
      router.refresh();
    },
  });
  const setDefaultMethod = trpc.payments.account.setDefaultWalletMethod.useMutation({
    onSuccess: () => router.refresh(),
  });

  async function handleSave(formData: FormData) {
    try {
      await saveMethod.mutateAsync({
        methodId: editing !== "new" ? editing?.id : undefined,
        provider: formData.get("provider") as SaveWalletMethodInput["provider"],
        msisdn: formData.get("msisdn") as string,
        label: (formData.get("label") as string) || undefined,
        makeDefault: formData.get("makeDefault") === "on",
      });
    } catch {
      // handled via saveMethod.error below
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteMethod.mutateAsync({ methodId: confirmDelete.id });
    } catch {
      // deletion failing silently matches the prior server-action behavior
    }
  }

  const saveError = saveMethod.error?.message ?? saveMethod.data?.error ?? null;

  return (
    <div className="space-y-4">
      <Alert>
        <Smartphone />
        <AlertDescription>
          We save wallet numbers so checkout can prefill them — never a PIN, and never a card. Every
          payment is still approved by you on your own handset.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {methods.length === 0
            ? "No saved payment details."
            : `${methods.length} saved payment method${methods.length === 1 ? "" : "s"}.`}
        </p>
        <Button onClick={() => setEditing("new")} className="gap-1.5">
          <Plus className="size-4" /> Add wallet
        </Button>
      </div>

      {methods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Smartphone className="size-5" />
            </span>
            <p className="font-medium">Save your mobile money number</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your EVC Plus, ZAAD, Sahal or eDahab number once and it will be filled in for you
              every time you pay.
            </p>
            <Button onClick={() => setEditing("new")} className="mt-1 gap-1.5">
              <Plus className="size-4" /> Add your first wallet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {methods.map((method) => (
            <Card key={method.id}>
              <CardContent className="flex items-center gap-3 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Smartphone className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {WALLET_LABELS.get(method.provider) ?? method.provider}
                    {method.is_default ? (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="size-3" /> Default
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {maskMsisdn(method.msisdn)}
                  </p>
                  {method.label ? (
                    <p className="truncate text-xs text-muted-foreground">{method.label}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!method.is_default ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Make default"
                      title="Make default"
                      disabled={setDefaultMethod.isPending}
                      onClick={() => setDefaultMethod.mutate({ methodId: method.id })}
                    >
                      <Star className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit"
                    onClick={() => setEditing(method)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove"
                    onClick={() => setConfirmDelete(method)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "Add a wallet" : "Edit saved wallet"}
            </DialogTitle>
            <DialogDescription>
              Enter the number you use to approve payments on your phone.
            </DialogDescription>
          </DialogHeader>

          <form
            key={editing === "new" ? "new" : (editing?.id ?? "none")}
            action={handleSave}
            className="space-y-4"
          >
            {saveError ? (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="wallet-provider">Wallet</Label>
              <Select
                name="provider"
                defaultValue={
                  editing !== "new" && editing?.provider ? editing.provider : "evc_plus"
                }
                items={WALLET_ITEMS}
              >
                <SelectTrigger id="wallet-provider" className="w-full">
                  <SelectValue placeholder="Select a wallet" />
                </SelectTrigger>
                <SelectContent>
                  {WALLET_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-msisdn">Wallet number</Label>
              <Input
                id="wallet-msisdn"
                name="msisdn"
                type="tel"
                inputMode="tel"
                required
                defaultValue={editing !== "new" ? (editing?.msisdn ?? "") : ""}
                placeholder="61 1234567"
                autoComplete="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-label">Nickname (optional)</Label>
              <Input
                id="wallet-label"
                name="label"
                defaultValue={editing !== "new" ? (editing?.label ?? "") : ""}
                placeholder="e.g. My personal number"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="wallet-default"
                name="makeDefault"
                defaultChecked={editing !== "new" ? (editing?.is_default ?? false) : true}
              />
              <Label htmlFor="wallet-default" className="font-normal">
                Use this as my default payment method
              </Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <SubmitButton pendingText="Saving…">Save</SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              {WALLET_LABELS.get(confirmDelete?.provider ?? "") ?? "This wallet"}{" "}
              {maskMsisdn(confirmDelete?.msisdn ?? null)} will no longer prefill at checkout. Past
              payments are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMethod.isPending}
              onClick={handleDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
