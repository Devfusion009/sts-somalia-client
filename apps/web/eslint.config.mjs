import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Enforces modules/README.md's "lib never depends on modules" rule —
  // src/lib is shared infrastructure every module can depend on, so the
  // reverse direction can't exist without risking a cycle. When lib
  // genuinely needs domain data (e.g. the old lib/auth/partner-contexts.ts),
  // the fix is relocating that code into a module (modules/identity/queries.ts
  // now), not importing modules from lib.
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*", "@/modules"],
              message:
                "src/lib must not depend on src/modules (see modules/README.md). Move the code that needs this into a module instead.",
            },
          ],
        },
      ],
    },
  },
  // Node test scripts run as CommonJS via `node --test`.
  {
    files: ["test/**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase-generated runtime artifacts (minified vendor code) — not ours
    // to lint; they drown real findings in hundreds of prefer-const errors.
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
