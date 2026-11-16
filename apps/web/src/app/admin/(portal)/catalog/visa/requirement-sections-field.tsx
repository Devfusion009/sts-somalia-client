"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  CHOICE_FIELD_TYPES,
  REQUIREMENT_FIELD_TYPES,
  REQUIREMENT_FIELD_TYPE_LABELS,
  type RequirementFieldType,
  type RequirementScope,
} from "@/modules/visa/schemas";
import {
  EMPTY_REQUIREMENT_FIELD_ROW,
  REQUIREMENT_TEMPLATES,
  type RequirementFieldRow,
  type RequirementSectionRow,
} from "@/modules/admin/visa-type-utils";

type FieldState = RequirementFieldRow & { uid: number };
type SectionState = Omit<RequirementSectionRow, "fields"> & { uid: number; fields: FieldState[] };

const SCOPE_LABELS: Record<RequirementScope, string> = {
  application: "Once per application",
  traveller: "Once per traveller",
};

/** Stable React keys for rows; module-level so render never reads a ref. */
let rowCounter = 0;
const newId = () => ++rowCounter;

function withIds(row: RequirementSectionRow): SectionState {
  return { ...row, uid: newId(), fields: row.fields.map((f) => ({ ...f, uid: newId() })) };
}

function toRow(section: SectionState): RequirementSectionRow {
  return {
    key: section.key,
    title: section.title,
    scope: section.scope,
    fields: section.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required, options: f.options })),
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Structured editor for visa_types.application_sections. Same
 * JSON-in-one-hidden-field pattern as DocumentSlotsField. Keys of saved
 * sections and fields are kept as-is (answers are stored under them); new
 * ones get a key from their label on save.
 */
export function RequirementSectionsField({ name, initialRows }: { name: string; initialRows: RequirementSectionRow[] }) {
  const uid = useId();
  const [sections, setSections] = useState<SectionState[]>(() => initialRows.map(withIds));
  const serialized = sections.map(toRow);

  function updateSection(i: number, patch: Partial<SectionState>) {
    setSections((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function updateField(i: number, j: number, patch: Partial<FieldState>) {
    setSections((list) =>
      list.map((s, idx) =>
        idx === i ? { ...s, fields: s.fields.map((f, fIdx) => (fIdx === j ? { ...f, ...patch } : f)) } : s
      )
    );
  }
  function addSection(row?: RequirementSectionRow) {
    setSections((list) => [
      ...list,
      withIds(row ?? { key: "", title: "", scope: "application", fields: [{ ...EMPTY_REQUIREMENT_FIELD_ROW }] }),
    ]);
  }

  return (
    <div className="@container/requirements space-y-5">
      <input type="hidden" name={name} value={JSON.stringify(serialized)} />

      {sections.map((section, i) => {
        const sid = `${uid}-s${section.uid}`;
        return (
          <section key={section.uid} aria-labelledby={`${sid}-heading`} className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
              <h3 id={`${sid}-heading`} className="flex items-center gap-2.5 text-sm font-semibold">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                Section {i + 1}
              </h3>
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {section.fields.length} {section.fields.length === 1 ? "field" : "fields"}
              </span>
            </header>
            <div className="space-y-5 p-4 sm:p-5">
              <div className="grid gap-3 @min-[42rem]/requirements:grid-cols-[minmax(0,1fr)_13rem_auto]">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`${sid}-title`} className="text-xs text-muted-foreground">Section title</Label>
                  <Input
                    id={`${sid}-title`}
                    value={section.title}
                    placeholder="Family details"
                    onChange={(e) => updateSection(i, { title: e.target.value })}
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs text-muted-foreground" aria-hidden="true">Applies to</Label>
                  <Select value={section.scope} onValueChange={(v) => updateSection(i, { scope: v as RequirementScope })}>
                    <SelectTrigger className="w-full" aria-label="Applies to">
                      <SelectValue>{(v: RequirementScope) => SCOPE_LABELS[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="application">{SCOPE_LABELS.application}</SelectItem>
                      <SelectItem value="traveller">{SCOPE_LABELS.traveller}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label="Move section up" disabled={i === 0} onClick={() => setSections((l) => move(l, i, i - 1))}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Move section down" disabled={i === sections.length - 1} onClick={() => setSections((l) => move(l, i, i + 1))}>
                    <ArrowDown />
                  </Button>
                  <ConfirmButton
                    title="Remove this section?"
                    description={section.title || undefined}
                    confirmLabel="Remove"
                    aria-label="Remove section"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onConfirm={() => setSections((l) => l.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 />
                  </ConfirmButton>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                {section.fields.map((field, j) => {
                  const fid = `${sid}-f${field.uid}`;
                  const isChoice = CHOICE_FIELD_TYPES.includes(field.type);
                  return (
                    <div key={field.uid} className="space-y-3 border-b border-border bg-card p-4 transition-colors focus-within:bg-muted/20">
                      <div className="grid grid-cols-2 gap-3 @min-[42rem]/requirements:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]">
                        <div className="col-span-2 min-w-0 space-y-1.5 @min-[42rem]/requirements:col-span-1">
                          <Label htmlFor={`${fid}-label`} className="text-xs text-muted-foreground">Field {j + 1}</Label>
                          <Input
                            id={`${fid}-label`}
                            value={field.label}
                            placeholder="Father's full name"
                            onChange={(e) => updateField(i, j, { label: e.target.value })}
                          />
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <Label className="text-xs text-muted-foreground" aria-hidden="true">Type</Label>
                          <Select value={field.type} onValueChange={(v) => updateField(i, j, { type: v as RequirementFieldType })}>
                            <SelectTrigger className="w-full" aria-label="Type">
                              <SelectValue>{(v: RequirementFieldType) => REQUIREMENT_FIELD_TYPE_LABELS[v]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {REQUIREMENT_FIELD_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>{REQUIREMENT_FIELD_TYPE_LABELS[type]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <Label className="text-xs text-muted-foreground" aria-hidden="true">Requirement</Label>
                          <Select
                            value={field.required ? "required" : "optional"}
                            onValueChange={(v) => updateField(i, j, { required: v === "required" })}
                          >
                            <SelectTrigger className="w-full" aria-label="Required">
                              <SelectValue>{(v: string) => (v === "required" ? "Required" : "Optional")}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="required">Required</SelectItem>
                              <SelectItem value="optional">Optional</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 flex items-end justify-end gap-1 @min-[42rem]/requirements:col-span-1">
                          <Button type="button" variant="ghost" size="icon" aria-label="Move field up" disabled={j === 0} onClick={() => updateSection(i, { fields: move(section.fields, j, j - 1) })}>
                            <ArrowUp />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" aria-label="Move field down" disabled={j === section.fields.length - 1} onClick={() => updateSection(i, { fields: move(section.fields, j, j + 1) })}>
                            <ArrowDown />
                          </Button>
                          <ConfirmButton
                            title="Remove this field?"
                            description={field.label || undefined}
                            confirmLabel="Remove"
                            aria-label="Remove field"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onConfirm={() => updateSection(i, { fields: section.fields.filter((_, idx) => idx !== j) })}
                          >
                            <Trash2 />
                          </ConfirmButton>
                        </div>
                      </div>
                      {isChoice ? (
                        <div className="min-w-0 space-y-1.5">
                          <Label htmlFor={`${fid}-options`} className="text-xs text-muted-foreground">Options, one per line</Label>
                          <Textarea
                            id={`${fid}-options`}
                            rows={3}
                            value={field.options}
                            placeholder={"Single\nMarried\nDivorced"}
                            onChange={(e) => updateField(i, j, { options: e.target.value })}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 w-full justify-start rounded-none bg-muted/20 px-4 font-medium text-primary hover:bg-primary/5 hover:text-primary"
                  onClick={() => updateSection(i, { fields: [...section.fields, { ...EMPTY_REQUIREMENT_FIELD_ROW, uid: newId() }] })}
                >
                  <Plus aria-hidden="true" /> Add field
                </Button>
              </div>
            </div>
          </section>
        );
      })}

      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="outline" size="default" className="rounded-lg border-primary/25 bg-primary/5 text-primary shadow-none hover:bg-primary/10 hover:text-primary" onClick={() => addSection()}>
          <Plus aria-hidden="true" /> Add section
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="outline" size="default" className="rounded-lg shadow-none" />}>
            <LayoutTemplate aria-hidden="true" /> Add from template <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            {REQUIREMENT_TEMPLATES.map((t) => (
              <DropdownMenuItem key={t.title} onClick={() => addSection(t)}>
                {t.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
