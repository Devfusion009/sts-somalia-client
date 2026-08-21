/**
 * Creates (or re-creates) a platform-admin account on the local stack.
 *
 * WHY A SCRIPT
 * Auth users live in the `auth` schema, which `supabase/seed.sql` does not
 * populate — so `supabase db reset` wipes every login, including the admin one,
 * and there is otherwise no record of how to get it back. Running this after a
 * reset restores console access in one command.
 *
 * WHY IT CAN'T USE set_platform_admin()
 * That RPC requires the caller to already be an admin. On a freshly reset
 * database nobody is, so the first admin has to be granted directly — which is
 * what this does, with the service-role key.
 *
 * USAGE
 *   npm run create:admin                                  # uses the defaults below
 *   ADMIN_EMAIL=x@y.com ADMIN_PASSWORD=... npm run create:admin
 *
 * LOCAL DEVELOPMENT ONLY. It writes a known password straight into the auth
 * store. Do not point it at a hosted project.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name) {
  const path = join(ROOT, name);
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
}

const env = { ...loadEnvFile("apps/web/.env.local"), ...process.env };
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = env.ADMIN_EMAIL ?? "admin_sts@gmail.com";
const PASSWORD = env.ADMIN_PASSWORD ?? "STS@2026";
const FULL_NAME = env.ADMIN_NAME ?? "STS Platform Admin";

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY (checked .env.local and env).");
  process.exit(1);
}

if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error(
    `Refusing to run against ${url}.\n` +
      "This script writes a known password into the auth store and is local-only.\n" +
      "Create hosted admins through the Supabase dashboard instead."
  );
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// Find an existing account first so re-runs update rather than fail on the
// unique email constraint.
const found = await fetch(
  `${url}/auth/v1/admin/users?filter=${encodeURIComponent(EMAIL)}`,
  { headers }
).then((r) => r.json());

const existing = (found.users ?? []).find((u) => u.email === EMAIL);
let userId;

if (existing) {
  userId = existing.id;
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`update failed: ${res.status} ${await res.text()}`);
  console.log(`Updated existing account ${EMAIL}`);
} else {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      // Skips the confirmation email: there is no inbox to check on a machine
      // that only catches mail locally.
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    }),
  });
  if (!res.ok) throw new Error(`create failed: ${res.status} ${await res.text()}`);
  userId = (await res.json()).id;
  console.log(`Created ${EMAIL}`);
}

// handle_new_user() creates the profile row with role 'customer'; the admin
// flag is a separate, deliberate grant.
const patch = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}`, {
  method: "PATCH",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({ is_platform_admin: true, full_name: FULL_NAME }),
});
if (!patch.ok) throw new Error(`grant failed: ${patch.status} ${await patch.text()}`);

console.log(`Granted platform admin.\n\n  Console: http://admin.stssomalia.test:3000/\n  Email:   ${EMAIL}\n`);
