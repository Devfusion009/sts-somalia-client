/**
 * Uploads the seeded catalog artwork into Supabase Storage.
 *
 * WHY THIS EXISTS
 * `supabase/seed.sql` can populate the `images` columns but it cannot put
 * bytes in a bucket — and `supabase db reset` clears storage.objects along
 * with everything else. Without this script, a reset leaves every package and
 * venue pointing at a storage key that has no file behind it.
 *
 * HOW IT WORKS
 * The database is the source of truth, not this file. It reads the storage
 * keys already recorded in umrah_packages.images / event_venues.images, and
 * uploads the matching file from supabase/seed-assets/. That means the seed
 * decides what artwork a row has, and this script only materialises it — the
 * two can never disagree about paths.
 *
 * Keys are `<row_id>/<filename>`, which is exactly what the admin upload flow
 * produces (see modules/umrah/admin-actions.ts), so seeded and
 * admin-uploaded images are indistinguishable to the rest of the app.
 *
 * USAGE
 *   npm run seed:storage                 # local stack, from .env.local
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm run seed:storage   # any env
 *
 * Idempotent: re-running overwrites the same keys. Safe after every reset.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
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
// Service-role only: the buckets are admin-write, and this runs as a
// maintenance task with no user session to borrow authority from.
const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing Supabase credentials.\n" +
      "  Expected NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and\n" +
      "  SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), from .env.local or the environment."
  );
  process.exit(1);
}

/** Which table feeds which bucket, and where its source files live. */
const SOURCES = [
  { table: "hotels", bucket: "hotel-images", assets: "supabase/seed-assets/hotels" },
  { table: "umrah_packages", bucket: "umrah-images", assets: "supabase/seed-assets/umrah" },
  { table: "event_venues", bucket: "venue-images", assets: "supabase/seed-assets/events" },
];

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function rowsWithImages(table) {
  const res = await fetch(
    `${url}/rest/v1/${table}?select=id,name,images&images=neq.[]`,
    { headers }
  );
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function upload(bucket, key_, body) {
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${key_}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "image/webp", "x-upsert": "true" },
    body,
  });
  if (!res.ok) throw new Error(`${bucket}/${key_}: ${res.status} ${await res.text()}`);
}

let uploaded = 0;
let skipped = 0;

for (const { table, bucket, assets } of SOURCES) {
  const dir = join(ROOT, assets);
  const available = existsSync(dir) ? new Set(readdirSync(dir)) : new Set();
  const rows = await rowsWithImages(table);

  console.log(`\n${table} → ${bucket}  (${rows.length} rows, ${available.size} source files)`);

  for (const row of rows) {
    for (const entry of row.images ?? []) {
      // Only seeded keys are handled. An admin-uploaded key has a timestamp
      // prefix and no matching source file; a full URL isn't ours at all.
      if (typeof entry !== "string" || entry.startsWith("http")) continue;
      const filename = entry.slice(entry.lastIndexOf("/") + 1);
      if (!available.has(filename)) {
        skipped += 1;
        continue;
      }
      await upload(bucket, entry, readFileSync(join(dir, filename)));
      uploaded += 1;
    }
    console.log(`  ✓ ${row.name}`);
  }
}

console.log(`\nUploaded ${uploaded} object(s).${skipped ? ` Skipped ${skipped} with no source file.` : ""}`);
