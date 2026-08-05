# Modules — the modular monolith

Each business domain lives in its own module with a consistent internal shape:

```
src/modules/<domain>/
  queries.ts     server-only reads (RLS-scoped Supabase queries)
  actions.ts     "use server" mutations (Zod-validated)
  schemas.ts     shared Zod schemas / domain types (when non-trivial)
  components/    domain-specific React components
```

Domains: `visa`, `hotels`, `umrah`, `flights`, `events` (halls & event bookings),
`orders` (unified order/ledger helpers), `payments` (env-driven provider
registry + checkout), `agencies` (B2B), `affiliates`, `partnerships`
(program applications), `identity` (profile), `admin`.

Rules of the road:

- **Cross-module access goes through the module's public files** (`queries.ts`,
  `actions.ts`, `helpers.ts`) — never reach into another module's components.
- **Shared infrastructure lives in `src/lib`** (Supabase clients, auth/session,
  integrations registry, utils) and **shared UI in `src/components`**
  (design system in `ui/`, marketing shell in `marketing/`, portal shell in
  `portal/`). Modules may depend on lib/components; lib never depends on
  modules.
- **Routes stay thin.** `src/app` composes module queries/components; business
  logic belongs in the module.
- Authorization is enforced by Postgres RLS; server code uses `requireUser()` +
  membership lookups (see `src/app/partner/layout.tsx` pattern) — do not gate
  multi-program portals on `profiles.role`.
