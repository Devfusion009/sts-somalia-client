import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";

type PostgrestLikeError = { code?: string; message: string; details?: string | null; hint?: string | null };

const logger = new Logger("Database");

/**
 * Turns a Supabase/Postgres error into the exception a client may see.
 * Only messages written for people pass through: P0001 is a guard's own
 * RAISE (e.g. "This venue is already booked for that slot."). Everything
 * else is logged in full and answered with the caller's one-line fallback,
 * so table names, constraint names and SQL never reach a browser.
 */
export function dbException(error: PostgrestLikeError, fallback: string): HttpException {
  if (error.code === "P0001") return new BadRequestException(error.message);
  if (error.code === "23505") return new ConflictException(fallback);
  logger.error(`${error.code ?? "?"} ${error.message}${error.details ? ` — ${error.details}` : ""}`);
  return new InternalServerErrorException(fallback);
}

/** Throws dbException(error, fallback) when error is set. */
export function throwIfDbError(error: PostgrestLikeError | null, fallback: string): void {
  if (error) throw dbException(error, fallback);
}
