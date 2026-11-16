/** Read only tab-local fields from the same persisted application revision. */
export function recoveredDraft(raw: string | null, revision: string, now = Date.now()): Record<string, string> | null {
  try {
    const draft = raw ? JSON.parse(raw) : null;
    if (!draft || draft.revision !== revision || typeof draft.at !== "number" || draft.at > now || now - draft.at >= 30 * 60 * 1000 || !draft.values || typeof draft.values !== "object" || Array.isArray(draft.values)) return null;
    return Object.fromEntries(Object.entries(draft.values).filter((entry): entry is [string, string] => typeof entry[1] === "string" && !/password|token|secret/i.test(entry[0])));
  } catch { return null; }
}
