"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPTY_DOCUMENT_SLOT_ROW, type DocumentSlotRow } from "@/modules/admin/visa-type-utils";

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
  const [rows, setRows] = useState<DocumentSlotRow[]>(initialRows);

  function update(i: number, patch: Partial<DocumentSlotRow>) {
    setRows(rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Key</Label>
              <Input
                value={row.key}
                placeholder="passport_bio"
                className="font-mono text-xs"
                onChange={(e) => update(i, { key: sanitizeKey(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input value={row.label} placeholder="Passport Bio Page" onChange={(e) => update(i, { label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Required</Label>
              <Select value={row.required} onValueChange={(v) => update(i, { required: v as DocumentSlotRow["required"] })}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max MB</Label>
              <Input
                type="number"
                min={0}
                value={row.max_mb}
                placeholder="5"
                className="w-20"
                onChange={(e) => update(i, { max_mb: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Description (optional)</Label>
              <Input
                value={row.description}
                placeholder="Color copy of passport bio page"
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </div>
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRows([...rows, { ...EMPTY_DOCUMENT_SLOT_ROW }])}>
        <Plus className="size-3.5" /> Add document
      </Button>
      <p className="text-xs text-muted-foreground">These become the upload boxes in the customer wizard.</p>
    </div>
  );
}
