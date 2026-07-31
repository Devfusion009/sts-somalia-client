"use client";

import { useActionState, useState } from "react";
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
import { createAffiliateLink } from "@/lib/actions/affiliate";

export function NewLinkForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createAffiliateLink, null);

  // Close the dialog once the action succeeds. Derived during render (not an
  // effect) per React's guidance for reacting to a value change: comparing
  // against the last-seen state and updating open state that changes.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus /> New link
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a tracked link</DialogTitle>
          <DialogDescription>Point it at any page on the site — a package, hotel, or the homepage.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="campaignName">Campaign name (optional)</Label>
            <Input id="campaignName" name="campaignName" placeholder="Instagram bio, newsletter…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetPath">Destination path</Label>
            <Input id="targetPath" name="targetPath" placeholder="/umrah/14-day-premium-umrah" defaultValue="/" required />
            <p className="text-xs text-muted-foreground">e.g. /, /hotels, /umrah/some-package-slug</p>
          </div>
          <SubmitButton className="w-full" pendingText="Creating…">
            Create link
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
