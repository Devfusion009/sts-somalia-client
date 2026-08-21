/**
 * Error strings shared between the private-builder Server Actions
 * (custom-actions.ts) and the wizard components that render them.
 *
 * A "use server" file may only export async functions — Next.js rejects any
 * other export from it at build time (verified: exporting this same string
 * from custom-actions.ts throws "Only async functions are allowed to be
 * exported in a 'use server' file" and takes the whole module down, breaking
 * every action in it). So the constant has to live in its own plain module
 * that both sides import.
 */

/**
 * The message every step's save action returns when the request behind the
 * URL is no longer an editable draft of the signed-in user's — already
 * submitted, discarded, or (rarely) a stale link into someone else's trip.
 * Exported so each step can recognise it and offer a way out instead of
 * leaving the customer stuck on a form that will never save: this used to be
 * a dead end with no link back to a working page.
 */
export const REQUEST_NOT_EDITABLE_ERROR =
  "This trip is no longer editable — it may already have been submitted or discarded. Start a new one below.";
