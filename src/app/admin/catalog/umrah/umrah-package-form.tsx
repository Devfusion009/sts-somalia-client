"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { createUmrahPackage, updateUmrahPackage } from "@/modules/admin/actions";
import type { Database } from "@/lib/types/database.types";

type UmrahPackage = Database["public"]["Tables"]["umrah_packages"]["Row"];

export function UmrahPackageForm({ pkg }: { pkg?: UmrahPackage }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = pkg ? updateUmrahPackage : createUmrahPackage;
  const [state, formAction] = useActionState(action, null);

  // Adjusted during render (not in an effect) per React's guidance for
  // deriving state from a state change; router.refresh() is the actual
  // side effect and stays in the effect below.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size={pkg ? "sm" : "default"} variant={pkg ? "outline" : "default"} />}>
        {pkg ? (
          <>
            <Pencil /> Edit
          </>
        ) : (
          <>
            <Plus /> Add package
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction}>
          {pkg ? <input type="hidden" name="id" value={pkg.id} /> : null}
          <DialogHeader>
            <DialogTitle>{pkg ? "Edit Umrah package" : "Add Umrah package"}</DialogTitle>
            <DialogDescription>Shown to customers on the public Umrah page once published.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={pkg?.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={pkg?.description ?? ""} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="durationDays">Duration (days)</Label>
                <Input id="durationDays" name="durationDays" type="number" min={1} defaultValue={pkg?.duration_days} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="basePrice">Base price</Label>
                <Input id="basePrice" name="basePrice" type="number" min={0} step="0.01" defaultValue={pkg?.base_price} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" maxLength={3} defaultValue={pkg?.currency ?? "USD"} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="includes">Includes (one per line)</Label>
              <Textarea
                id="includes"
                name="includes"
                rows={3}
                defaultValue={((pkg?.includes as string[] | null) ?? []).join("\n")}
                placeholder={"flights\nvisa\nhotel"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={pkg?.status ?? "draft"}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_review">Pending review</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{pkg ? "Save changes" : "Create"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
