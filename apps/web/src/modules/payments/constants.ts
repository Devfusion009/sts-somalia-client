/**
 * Lives outside actions.ts (a "use server" file) because such files may only
 * export async functions — a plain const export breaks the entire module.
 */
export const MIN_DEPOSIT_FRACTION = 0.5;
