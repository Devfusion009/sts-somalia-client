/**
 * Serializes visa_types.required_documents (structured jsonb) back into the
 * one-slot-per-line editing format used by the admin catalog form:
 * `key|Label|required|maxMB|description` (trailing segments optional).
 */
export function documentSlotsToLines(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw
    .map((entry) => {
      if (typeof entry === "string") return `${entry}|${entry.replace(/_/g, " ")}|required`;
      const slot = entry as {
        key?: string;
        label?: string;
        required?: boolean;
        max_mb?: number;
        description?: string;
      };
      return [
        slot.key ?? "document",
        slot.label ?? slot.key ?? "Document",
        slot.required === false ? "optional" : "required",
        slot.max_mb ?? "",
        slot.description ?? "",
      ]
        .join("|")
        .replace(/\|+$/, "");
    })
    .join("\n");
}
