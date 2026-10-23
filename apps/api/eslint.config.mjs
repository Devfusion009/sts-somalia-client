// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // Module boundaries: another module's repositories, mappers and
      // internals are private — go through its index.ts / exported service.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/modules/*/repositories/**", "../*/repositories/**", "**/modules/*/mappers/**", "../*/mappers/**"],
              message: "Import another module through its index.ts or exported service, not its internals.",
            },
          ],
        },
      ],
    },
  }
);
