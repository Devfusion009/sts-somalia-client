/** One row in the admin's structured "Document upload slots" editor. */
export type DocumentSlotRow = {
  key: string;
  label: string;
  required: "required" | "optional";
  max_mb: string;
  description: string;
};

/** One row in the admin's structured "Application questions" editor. */
export type ApplicationQuestionRow = {
  key: string;
  label: string;
  type: "text" | "yesno" | "select";
  options: string;
  required: "required" | "optional";
};

export const EMPTY_DOCUMENT_SLOT_ROW: DocumentSlotRow = {
  key: "",
  label: "",
  required: "required",
  max_mb: "",
  description: "",
};

export const EMPTY_APPLICATION_QUESTION_ROW: ApplicationQuestionRow = {
  key: "",
  label: "",
  type: "text",
  options: "",
  required: "required",
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

/** Loads visa_types.application_questions (structured jsonb) into the editor's row shape. */
export function applicationQuestionsToRows(raw: unknown): ApplicationQuestionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const q = entry as { key?: string; label?: string; type?: string; options?: string[]; required?: boolean };
    const type = q.type === "yesno" || q.type === "select" ? q.type : "text";
    return {
      key: q.key ?? "",
      label: q.label ?? "",
      type,
      options: Array.isArray(q.options) ? q.options.join(", ") : "",
      required: q.required === false ? "optional" : "required",
    };
  });
}
