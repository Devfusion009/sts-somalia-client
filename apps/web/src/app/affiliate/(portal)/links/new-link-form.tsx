"use client";

import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";

export function NewLinkForm() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const createLink = trpc.affiliates.createLink.useMutation({
    onSuccess: () => {
      utils.affiliates.myLinks.invalidate();
      utils.affiliates.dashboard.invalidate();
      setOpen(false);
    },
  });

  // async + awaited mutateAsync (not the fire-and-forget .mutate()) so that
  // SubmitButton's useFormStatus()-based pending state — unchanged from the
  // Server Action version — tracks the mutation's actual duration instead of
  // resolving the instant this function returns. The catch is deliberate:
  // createLink.error (rendered below) is the display path for failures, so
  // this only exists to stop the rejection from reaching a form-action error
  // boundary.
  async function handleSubmit(formData: FormData) {
    try {
      await createLink.mutateAsync({
        campaignName: (formData.get("campaignName") as string) || undefined,
        targetPath: (formData.get("targetPath") as string) || "/",
      });
    } catch {
      // handled via createLink.error
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) createLink.reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus /> New link
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a tracked link</DialogTitle>
          <DialogDescription>Point it at any page on the site — a package, hotel, or the homepage.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {createLink.error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{createLink.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="campaignName">Campaign name (optional)</Label>
            <Input id="campaignName" name="campaignName" placeholder="Instagram bio, newsletter…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetPath">Destination path</Label>
            <Input id="targetPath" name="targetPath" placeholder="/umrah/14-day-premium-umrah" defaultValue="/" required />
          </div>
          <SubmitButton className="w-full" pendingText="Creating…">
            Create link
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
