"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Smartphone, Star, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
      toast.success("Wallet saved.");
      router.refresh();
    },
  });
  const deleteMethod = trpc.payments.account.deleteWalletMethod.useMutation({
    onSuccess: () => {
      setConfirmDelete(null);
      toast.success("Wallet removed.");
      router.refresh();
    },
  });
  const setDefaultMethod = trpc.payments.account.setDefaultWalletMethod.useMutation({
    onSuccess: () => router.refresh(),
    onError: (error) => toast.error(error.message),
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the wallet.");
    }
  }

  const saveError = saveMethod.error?.message ?? saveMethod.data?.error ?? null;

  const addButton = (
    <Button onClick={() => setEditing("new")}>
      <Plus data-icon="inline-start" /> Add wallet
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Smartphone className="size-5" aria-hidden /></span>Saved wallets</CardTitle>
        <CardAction>{addButton}</CardAction>
      </CardHeader>
      <CardContent>
        {methods.length === 0 ? (
          <div className="flex items-center gap-4 rounded-xl border border-dashed bg-muted/20 p-5"><span className="grid size-11 place-items-center rounded-xl bg-background text-muted-foreground"><Smartphone className="size-5" aria-hidden /></span><span className="text-sm text-muted-foreground">No saved mobile wallets</span></div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {methods.map((method) => {
              const name = WALLET_LABELS.get(method.provider) ?? method.provider;
              return (
                <li key={method.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${method.is_default ? "border-primary/50 bg-primary/[0.025]":"border-border"}`}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Smartphone className="size-5" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {name}
                      {method.is_default ? <Badge variant="secondary">Default</Badge> : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground tabular-nums">
                      {maskMsisdn(method.msisdn)}
                      {method.label ? ` · ${method.label}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!method.is_default ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Make ${name} default`}
                        title="Make default"
                        disabled={setDefaultMethod.isPending}
                        onClick={() => setDefaultMethod.mutate({ methodId: method.id })}
                      >
                        <Star />
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${name}`}
                      title="Edit"
                      onClick={() => setEditing(method)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Remove ${name}`}
                      title="Remove"
                      onClick={() => setConfirmDelete(method)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "Add wallet" : "Edit wallet"}
            </DialogTitle>
          </DialogHeader>

          <form key={editing === "new" ? "new" : (editing?.id ?? "none")} action={handleSave}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="wallet-provider">Wallet</FieldLabel>
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
              </Field>

              <Field>
                <FieldLabel htmlFor="wallet-msisdn">Wallet number</FieldLabel>
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
              </Field>

              <Field>
                <FieldLabel htmlFor="wallet-label">Nickname</FieldLabel>
                <Input
                  id="wallet-label"
                  name="label"
                  defaultValue={editing !== "new" ? (editing?.label ?? "") : ""}
                  placeholder="Optional, e.g. Personal"
                />
              </Field>

              <Field orientation="horizontal" className="justify-start">
                <Checkbox
                  id="wallet-default"
                  name="makeDefault"
                  defaultChecked={editing !== "new" ? (editing?.is_default ?? false) : true}
                />
                <Label htmlFor="wallet-default" className="font-normal">
                  Default payment method
                </Label>
              </Field>

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
                {saveError ? (
                  <p role="alert" className="text-sm text-destructive sm:mr-auto">
                    {saveError}
                  </p>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <SubmitButton pendingText="Saving…">Save</SubmitButton>
              </div>
            </FieldGroup>
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
              {maskMsisdn(confirmDelete?.msisdn ?? null)} is removed from your saved wallets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={deleteMethod.isPending}
              onClick={handleDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
