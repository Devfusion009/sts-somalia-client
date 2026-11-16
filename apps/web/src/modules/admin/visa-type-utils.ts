import {
  CHOICE_FIELD_TYPES,
  REQUIREMENT_FIELD_TYPES,
  parseRequirementSections,
  type RequirementFieldType,
  type RequirementScope,
  type RequirementSection,
} from "@/modules/visa/schemas";

/** One row in the admin's structured "Document upload slots" editor. */
export type DocumentSlotRow = {
  key: string;
  label: string;
  required: "required" | "optional";
  max_mb: string;
  description: string;
};

export const EMPTY_DOCUMENT_SLOT_ROW: DocumentSlotRow = {
  key: "",
  label: "",
  required: "required",
  max_mb: "",
  description: "",
};

/**
 * A document slot's / question's `key` becomes a literal identifier
 * downstream — a form field name, a storage-path segment
 * (uploadVisaDocument builds `${applicationId}/${key}-...`), and a
 * `document_type`/`custom_answers` jsonb key. Free text typed into the
 * admin's row editor is NOT trusted as-is; it's re-sanitized here
 * regardless of what the client already did, the same way the old
 * pipe-text format silently enforced this by only ever accepting
 * `[a-z0-9_]` in that position.
 */
export function sanitizeKey(input: string, fallback: string) {
  const key = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key || fallback;
}

/**
 * Rows from the admin's structured document-slot editor, serialized as one
 * JSON string (see DocumentSlotsField). Replaces the old
 * `key|Label|required|maxMB|description` pipe-text textarea — the DB has
 * always stored this as real jsonb, so there's no format to preserve here,
 * just structure + key sanitization to re-apply.
 *
 * Lives here, not in actions.ts, because that file has a top-level
 * "use server" directive — every export from a Server Action file must
 * itself be an async Server Action, and a plain synchronous helper exported
 * from one breaks the entire app at compile time, not just its own caller.
 */
export function parseDocumentSlotsJson(input: string | undefined) {
  if (!input) return [];
  let rows: unknown;
  try {
    rows = JSON.parse(input);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, i) => {
      const r = (row ?? {}) as Record<string, string>;
      const key = sanitizeKey(r.key ?? "", `document_${i + 1}`);
      const label = (r.label ?? "").trim() || key.replace(/_/g, " ");
      const maxMb = Number(r.max_mb);
      return {
        key,
        label,
        required: r.required !== "optional" && r.required !== "false",
        ...(maxMb > 0 ? { max_mb: maxMb } : {}),
        ...(r.description?.trim() ? { description: r.description.trim() } : {}),
      };
    })
    .filter((slot) => slot.label);
}

/** Loads visa_types.required_documents (structured jsonb) into the editor's row shape. */
export function documentSlotsToRows(raw: unknown): DocumentSlotRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (typeof entry === "string") {
      return { key: entry, label: entry.replace(/_/g, " "), required: "required", max_mb: "", description: "" };
    }
    const slot = entry as { key?: string; label?: string; required?: boolean; max_mb?: number; description?: string };
    return {
      key: slot.key ?? "",
      label: slot.label ?? slot.key ?? "",
      required: slot.required === false ? "optional" : "required",
      max_mb: slot.max_mb ? String(slot.max_mb) : "",
      description: slot.description ?? "",
    };
  });
}

/** One field row in the admin's "Application requirements" editor. Options are one per line. */
export type RequirementFieldRow = {
  key: string;
  label: string;
  type: RequirementFieldType;
  required: boolean;
  options: string;
};

/** One section in the admin's "Application requirements" editor. */
export type RequirementSectionRow = {
  key: string;
  title: string;
  scope: RequirementScope;
  fields: RequirementFieldRow[];
};

export const EMPTY_REQUIREMENT_FIELD_ROW: RequirementFieldRow = {
  key: "",
  label: "",
  type: "short_text",
  required: true,
  options: "",
};

/** Loads visa_types.application_sections into the editor's row shape. */
export function requirementSectionsToRows(raw: unknown): RequirementSectionRow[] {
  return parseRequirementSections(raw).map((section) => ({
    key: section.key,
    title: section.title,
    scope: section.scope,
    fields: section.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      options: (field.options ?? []).join("\n"),
    })),
  }));
}

function uniqueKey(base: string, taken: Set<string>) {
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
  taken.add(key);
  return key;
}

/**
 * Rows from the requirements editor, serialized as one JSON string. Keys are
 * re-sanitized and de-duplicated here: they become form field names,
 * jsonb keys and document_type values downstream. Fields without a label,
 * choice fields without options and sections without fields are dropped.
 */
export function parseRequirementSectionsJson(input: string | undefined): RequirementSection[] {
  if (!input) return [];
  let rows: unknown;
  try {
    rows = JSON.parse(input);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const sectionKeys = new Set<string>();
  const sections: RequirementSection[] = [];
  rows.forEach((row, i) => {
    const r = (row ?? {}) as Partial<RequirementSectionRow>;
    const title = String(r.title ?? "").trim();
    if (!title) return;
    const fieldKeys = new Set<string>();
    const fields = (Array.isArray(r.fields) ? r.fields : []).flatMap((f, j) => {
      const field = (f ?? {}) as Partial<RequirementFieldRow>;
      const label = String(field.label ?? "").trim();
      const type = REQUIREMENT_FIELD_TYPES.find((t) => t === field.type) ?? "short_text";
      if (!label) return [];
      const options = String(field.options ?? "")
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean);
      const isChoice = CHOICE_FIELD_TYPES.includes(type);
      if (isChoice && options.length === 0) return [];
      return [
        {
          key: uniqueKey(sanitizeKey(String(field.key ?? "") || label, `field_${j + 1}`), fieldKeys),
          label,
          type,
          required: field.required !== false,
          ...(isChoice ? { options: [...new Set(options)] } : {}),
        },
      ];
    });
    if (fields.length === 0) return;
    sections.push({
      key: uniqueKey(sanitizeKey(String(r.key ?? "") || title, `section_${i + 1}`), sectionKeys),
      title,
      scope: r.scope === "traveller" ? "traveller" : "application",
      fields,
    });
  });
  return sections;
}

type TemplateField = [label: string, type: RequirementFieldType, required?: boolean, options?: string[]];

function template(title: string, scope: RequirementScope, fields: TemplateField[]): RequirementSectionRow {
  return {
    key: "",
    title,
    scope,
    fields: fields.map(([label, type, required = true, options]) => ({
      key: "",
      label,
      type,
      required,
      options: (options ?? []).join("\n"),
    })),
  };
}

/** Starting points for common consulate requirements; admin edits after inserting. */
export const REQUIREMENT_TEMPLATES: RequirementSectionRow[] = [
  template("Personal details", "traveller", [
    ["Place of birth", "short_text"],
    ["Marital status", "dropdown", true, ["Single", "Married", "Divorced", "Widowed"]],
    ["Religion", "short_text", false],
    ["Identifying marks", "short_text", false],
  ]),
  template("Passport details", "traveller", [
    ["Date of issue", "date"],
    ["Place of issue", "short_text"],
    ["Issuing authority", "short_text"],
  ]),
  template("Contact & address", "application", [
    ["Residential address", "long_text"],
    ["City", "short_text"],
    ["Country of residence", "country"],
    ["Alternative phone", "phone", false],
  ]),
  template("Travel itinerary", "application", [
    ["Port of entry", "short_text"],
    ["Port of exit", "short_text"],
    ["Places to visit", "long_text", false],
  ]),
  template("Employment & education", "traveller", [
    ["Occupation", "short_text"],
    ["Employer or school name", "short_text"],
    ["Employer or school address", "long_text"],
    ["Monthly income (USD)", "number", false],
    ["Income certificate", "file", false],
  ]),
  template("Family details", "traveller", [
    ["Father's full name", "short_text"],
    ["Father's nationality", "country"],
    ["Father's place of birth", "short_text"],
    ["Mother's full name", "short_text"],
    ["Mother's nationality", "country"],
    ["Mother's place of birth", "short_text"],
    ["Spouse's full name", "short_text", false],
    ["Spouse's nationality", "country", false],
  ]),
  template("Security & background", "traveller", [
    ["Have you ever been convicted of a criminal offence?", "yes_no"],
    ["Have you ever been refused a visa?", "yes_no"],
    ["Have you ever been deported from any country?", "yes_no"],
    ["Details, if you answered yes", "long_text", false],
  ]),
];
