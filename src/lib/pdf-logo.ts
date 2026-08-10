import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The STS mark, loaded as bytes for @react-pdf/renderer.
 *
 * Passed as a Buffer rather than a path or URL. react-pdf resolves a string
 * `src` relative to the process working directory and fetches http(s) ones over
 * the network — both are fragile in a deployed Next server, and a network fetch
 * inside PDF generation would make invoice downloads fail whenever the asset
 * host is slow. Reading the file we already ship removes both failure modes.
 *
 * Cached at module scope: invoice and voucher rendering both hit this on every
 * download, and the file never changes at runtime.
 */
let cached: Buffer | null = null;

export function stsLogo(): { data: Buffer; format: "png" } | null {
  if (!cached) {
    try {
      cached = readFileSync(join(process.cwd(), "public", "logo.png"));
    } catch {
      // A missing asset must not take down invoice generation — the documents
      // fall back to their wordmark, which is what they printed before.
      return null;
    }
  }
  return { data: cached, format: "png" };
}

/** Natural aspect ratio of logo.png (714×312), so callers only pick a width. */
export const STS_LOGO_ASPECT = 714 / 312;
