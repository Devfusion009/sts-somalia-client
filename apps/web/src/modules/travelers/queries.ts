/**
 * Types only, not queries. The actual query functions moved to apps/api's
 * TravelersService (phase 4b) — pages now call them via getServerTrpc()/
 * the trpc client instead. Kept as a re-export under this path so existing
 * component type imports (`from "../queries"` / `"@/modules/travelers/queries"`)
 * need no changes.
 */
export type { TravelerProfile, TravelerDocument, VaultDocument } from "@sts/shared-types";
