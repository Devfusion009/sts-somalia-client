"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
        <Plus aria-hidden="true" /> New link
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New tracked link</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="campaignName">Campaign</FieldLabel>
              <Input id="campaignName" name="campaignName" placeholder="Instagram bio, newsletter…" />
            </Field>
            <Field data-invalid={createLink.error ? true : undefined}>
              <FieldLabel htmlFor="targetPath">Destination path</FieldLabel>
              <Input
                id="targetPath"
                name="targetPath"
                placeholder="/umrah/14-day-premium-umrah"
                defaultValue="/"
                required
                className="font-mono"
                aria-invalid={createLink.error ? true : undefined}
              />
              <FieldError>{createLink.error?.message}</FieldError>
            </Field>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <SubmitButton pendingText="Creating…">Create link</SubmitButton>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
