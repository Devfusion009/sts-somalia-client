import "server-only";
import { createHash } from "node:crypto";

export function waafiCredentialRevision(encrypted: string) {
  return createHash("sha256").update(encrypted).digest("hex");
}

export function waafiSetupVerified(encrypted: string | null, config: Record<string, unknown>, tested: boolean | null) {
  const setup = config.waafi_setup as { revision?: string } | undefined;
  return !!encrypted && tested === true && setup?.revision === waafiCredentialRevision(encrypted);
}
