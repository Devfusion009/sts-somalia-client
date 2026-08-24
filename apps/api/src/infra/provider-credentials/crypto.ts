import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Direct port of apps/web's lib/integrations-crypto.ts — AES-256-GCM for
 * platform_api_integrations.credentials_encrypted. INTEGRATIONS_ENCRYPTION_KEY
 * must be set identically on apps/web and apps/api: both read/decrypt rows
 * the admin console (apps/web, still unmigrated) writes/encrypts today.
 * Ciphertext format unchanged: base64(iv[12] + authTag[16] + encrypted).
 */

function getKey(): Buffer {
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!secret) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not set.");
  return createHash("sha256").update(secret).digest();
}

export function decryptCredentials(ciphertext: string): Record<string, string> {
  const raw = Buffer.from(ciphertext, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

export function encryptCredentials(credentials: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(credentials), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}
