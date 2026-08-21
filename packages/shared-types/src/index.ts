import { z } from "zod";

/**
 * Phase-0 proof of the type-sharing pattern: apps/api's response shape and
 * apps/web's expectation of it come from the same schema, not two
 * hand-kept copies. Real modules migrate their existing schemas.ts Zod
 * schemas here as they move, rather than reinventing validation apps/web
 * already has.
 */
export const meResultSchema = z.object({
  userId: z.string(),
  email: z.string().nullable(),
  isPlatformAdmin: z.boolean(),
});

export type MeResult = z.infer<typeof meResultSchema>;
