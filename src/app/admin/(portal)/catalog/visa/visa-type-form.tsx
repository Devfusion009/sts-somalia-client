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
import { createVisaType, updateVisaType } from "@/modules/admin/actions";
import { documentSlotsToLines } from "@/modules/admin/visa-type-utils";
import type { Database } from "@/lib/types/database.types";

type VisaType = Database["public"]["Tables"]["visa_types"]["Row"];

export function VisaTypeForm({ visaType }: { visaType?: VisaType }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = visaType ? updateVisaType : createVisaType;
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button size={visaType ? "sm" : "default"} variant={visaType ? "outline" : "default"} />}>
        {visaType ? (
          <>
            <Pencil /> Edit
          </>
        ) : (
          <>
            <Plus /> Add visa type
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction}>
          {visaType ? <input type="hidden" name="id" value={visaType.id} /> : null}
          <DialogHeader>
            <DialogTitle>{visaType ? "Edit visa type" : "Add visa type"}</DialogTitle>
            <DialogDescription>Shown to customers on the public visa page once published.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="destinationCountryCode">Country code (2 letters)</Label>
                <Input
                  id="destinationCountryCode"
                  name="destinationCountryCode"
                  maxLength={2}
                  defaultValue={visaType?.destination_country_code}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" maxLength={3} defaultValue={visaType?.currency ?? "USD"} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={visaType?.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={visaType?.description ?? ""} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="overview">Overview (shown on the detail page)</Label>
              <Textarea id="overview" name="overview" defaultValue={visaType?.overview ?? ""} rows={3} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visaCategory">Category</Label>
                <Select name="visaCategory" defaultValue={visaType?.visa_category ?? "tourist"}>
                  <SelectTrigger id="visaCategory" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tourist">Tourist</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="transit">Transit</SelectItem>
                    <SelectItem value="umrah">Umrah</SelectItem>
                    <SelectItem value="work">Work</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="family_visit">Family visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="entryType">Entries</Label>
                <Select name="entryType" defaultValue={visaType?.entry_type ?? "single"}>
                  <SelectTrigger id="entryType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single entry</SelectItem>
                    <SelectItem value="multiple">Multiple entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="validityDays">Validity (days)</Label>
                <Input
                  id="validityDays"
                  name="validityDays"
                  type="number"
                  min={0}
                  defaultValue={visaType?.validity_days ?? undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stayDays">Max stay (days)</Label>
                <Input
                  id="stayDays"
                  name="stayDays"
                  type="number"
                  min={0}
                  defaultValue={visaType?.stay_days ?? undefined}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="processingDaysMin">Min days</Label>
                <Input
                  id="processingDaysMin"
                  name="processingDaysMin"
                  type="number"
                  min={0}
                  defaultValue={visaType?.processing_days_min ?? undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="processingDaysMax">Max days</Label>
                <Input
                  id="processingDaysMax"
                  name="processingDaysMax"
                  type="number"
                  min={0}
                  defaultValue={visaType?.processing_days_max ?? undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input id="price" name="price" type="number" min={0} step="0.01" defaultValue={visaType?.price} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="requiredDocuments">Document upload slots (one per line)</Label>
              <Textarea
                id="requiredDocuments"
                name="requiredDocuments"
                rows={5}
                defaultValue={documentSlotsToLines(visaType?.required_documents)}
                placeholder={"passport_bio|Passport Bio Page|required|5|Color copy of passport bio page\nphoto|Passport Size Photo|required|2"}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Format: <code>key|Label|required or optional|max MB|description</code> — the last
                two parts are optional. These become the upload boxes in the customer wizard.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={visaType?.is_featured ?? false}
                className="size-4 accent-primary"
              />
              Featured (shown under &ldquo;Popular destinations&rdquo;)
            </label>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={visaType?.status ?? "draft"}>
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
            <SubmitButton pendingText="Saving…">{visaType ? "Save changes" : "Create"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
