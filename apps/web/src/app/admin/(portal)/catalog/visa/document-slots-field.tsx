"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPTY_DOCUMENT_SLOT_ROW, type DocumentSlotRow } from "@/modules/admin/visa-type-utils";
import { ConfirmButton } from "@/components/ui/confirm-button";

/** Lowercase + underscores only — the server re-sanitizes regardless, this is just so the admin sees the real key as they type it. */
function sanitizeKey(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

/**
 * Structured editor for visa_types.required_documents — replaces the old
 * `key|Label|required|maxMB|description` pipe-text textarea. Serializes to
 * one hidden JSON field on submit (same pattern as RepeatableRows in
 * partner-applications/field-helpers.tsx): local state drives the hidden
 * input's value, so it survives React 19's post-action field reset instead
 * of a raw uncontrolled DOM value that would.
 */
export function DocumentSlotsField({ name, initialRows }: { name: string; initialRows: DocumentSlotRow[] }) {
  const uid = useId();
  const [rows, setRows] = useState<DocumentSlotRow[]>(initialRows);

  function update(i: number, patch: Partial<DocumentSlotRow>) {
    setRows(rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div key={i} className="space-y-3 rounded-lg bg-muted/40 p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
            <div className="space-y-1">
              <Label htmlFor={`${uid}-key-${i}`} className="text-xs text-muted-foreground">Key</Label>
              <Input id={`${uid}-key-${i}`}
                value={row.key}
                placeholder="passport_bio"
                className="font-mono text-xs"
                onChange={(e) => update(i, { key: sanitizeKey(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-label-${i}`} className="text-xs text-muted-foreground">Label</Label>
              <Input id={`${uid}-label-${i}`} value={row.label} placeholder="Passport Bio Page" onChange={(e) => update(i, { label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground" aria-hidden="true">Required</Label>
              <Select value={row.required} onValueChange={(v) => update(i, { required: v as DocumentSlotRow["required"] })}>
                <SelectTrigger className="w-full sm:w-28" aria-label="Required">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-max-mb-${i}`} className="text-xs text-muted-foreground">Max MB</Label>
              <Input id={`${uid}-max-mb-${i}`}
                type="number"
                min={0}
                value={row.max_mb}
                placeholder="5"
                className="w-full tabular-nums sm:w-20"
                onChange={(e) => update(i, { max_mb: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`${uid}-description-optional-${i}`} className="text-xs text-muted-foreground">Description</Label>
              <Input id={`${uid}-description-optional-${i}`}
                value={row.description}
                placeholder="Color copy of passport bio page"
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </div>
            <ConfirmButton
              title="Remove this document slot?"
              confirmLabel="Remove"
              aria-label="Remove document slot"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onConfirm={() => setRows(rows.filter((_, idx) => idx !== i))}
            >
              <Trash2 />
            </ConfirmButton>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { ...EMPTY_DOCUMENT_SLOT_ROW }])}>
        <Plus aria-hidden="true" /> Add document
      </Button>
    </div>
  );
}
