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
