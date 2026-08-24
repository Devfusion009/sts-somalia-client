/**
 * Re-export, not a definition. The generated Supabase schema types moved to
 * packages/shared-types (phase 4b) so apps/api's Supabase clients can share
 * the exact same relationship typing apps/web always had — without it,
 * postgrest-js can't tell a to-one join from a to-many one. This file stays
 * as a re-export rather than being deleted so the many existing
 * `@/lib/types/database.types` imports across this app need no changes.
 * Regenerate with `npm run db:types` (writes to packages/shared-types now).
 */
export type { Database, Json } from "@sts/shared-types";
