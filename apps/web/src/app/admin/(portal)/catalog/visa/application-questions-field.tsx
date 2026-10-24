"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPTY_APPLICATION_QUESTION_ROW, type ApplicationQuestionRow } from "@/modules/admin/visa-type-utils";
import { ConfirmButton } from "@/components/ui/confirm-button";

function sanitizeKey(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

/**
 * Structured editor for visa_types.application_questions — country-specific
 * extra questions the customer answers at the end of the wizard's Travel
 * Information step (see StepTravelInfo). Same JSON-in-one-hidden-field
 * pattern as DocumentSlotsField, for the same React-19-field-reset reason.
 */
export function ApplicationQuestionsField({ name, initialRows }: { name: string; initialRows: ApplicationQuestionRow[] }) {
  const uid = useId();
  const [rows, setRows] = useState<ApplicationQuestionRow[]>(initialRows);

  function update(i: number, patch: Partial<ApplicationQuestionRow>) {
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
                placeholder="previous_visa_refusal"
                className="font-mono text-xs"
                onChange={(e) => update(i, { key: sanitizeKey(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-question-${i}`} className="text-xs text-muted-foreground">Question</Label>
              <Input id={`${uid}-question-${i}`}
                value={row.label}
                placeholder="Have you ever been refused a visa?"
                onChange={(e) => update(i, { label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground" aria-hidden="true">Type</Label>
              <Select value={row.type} onValueChange={(v) => update(i, { type: v as ApplicationQuestionRow["type"] })}>
                <SelectTrigger className="w-full sm:w-28" aria-label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="yesno">Yes / No</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground" aria-hidden="true">Required</Label>
              <Select value={row.required} onValueChange={(v) => update(i, { required: v as ApplicationQuestionRow["required"] })}>
                <SelectTrigger className="w-full sm:w-28" aria-label="Required">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {row.type === "select" ? (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor={`${uid}-options-comma-separated-${i}`} className="text-xs text-muted-foreground">Options</Label>
                <Input id={`${uid}-options-comma-separated-${i}`} value={row.options} placeholder="Yes, No, Not applicable" onChange={(e) => update(i, { options: e.target.value })} />
              </div>
              <ConfirmButton
                title="Remove this question?"
                confirmLabel="Remove"
                aria-label="Remove question"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onConfirm={() => setRows(rows.filter((_, idx) => idx !== i))}
              >
                <Trash2 />
              </ConfirmButton>
            </div>
          ) : (
            <div className="flex justify-end">
              <ConfirmButton
                title="Remove this question?"
                confirmLabel="Remove"
                aria-label="Remove question"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onConfirm={() => setRows(rows.filter((_, idx) => idx !== i))}
              >
                <Trash2 />
              </ConfirmButton>
            </div>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { ...EMPTY_APPLICATION_QUESTION_ROW }])}>
        <Plus aria-hidden="true" /> Add question
      </Button>
    </div>
  );
}
