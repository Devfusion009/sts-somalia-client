# apps/api — module structure

A modular monolith: one NestJS process, one feature module per business domain,
and hard rules about what a module may expose. `src/modules/events` (small) and
`src/modules/umrah` (large: `services/`, `repositories/`, `mappers/`, a REST
controller for uploads) are the reference implementations.

## Layout

```
src/
  config/env.ts              validated environment (fails at boot; read via env())
  common/errors/db-error.ts  database error -> client-safe exception
  trpc/                      transport plumbing: context, auth procedures, logging
  infra/                     clients for things outside the app (Supabase, Redis, email, payment gateways)
  modules/<domain>/
    index.ts                 public API: the module, its exported service, its router
    <domain>.module.ts       Nest wiring; exports the service only
    <domain>.router.ts       transport: input DTO -> service -> output DTO
    <domain>.service.ts      business rules; no table or column names
    repositories/*.ts        data access; the only files that query the database
    mappers/*.ts             database row -> output DTO
packages/shared-types/src/<domain>.ts   the domain contract: DTOs + pure rules
```

## Layers and what each may do

| Layer | Owns | Never |
|---|---|---|
| Router | `.input(schema)`, `.output(schema)`, auth level (`publicProcedure` / `protectedProcedure` / `protectedAdminProcedure`), the caller's id from `ctx.user` | rules, queries, `if` on business state |
| Service | decisions: dates, prices, capacity, permissions, status moves, calling other modules' services | `.from("table")`, raw SQL, HTTP request objects |
| Repository | `.from()`, `.rpc()`, column lists, `throwIfDbError` | business decisions, throwing for "not allowed" |
| Mapper | row -> DTO through the shared schema | IO of any kind |
| Contract (`shared-types/<domain>.ts`) | zod input + output schemas, inferred types, pure rules both apps must agree on (price, transitions, labels) | IO, Nest, Supabase |

## DTOs

- **Input DTO**: a zod schema in the domain contract. The router passes it to
  `.input()`. The web app imports the same schema for client-side validation,
  so both sides reject the same things with the same message.
- **Output DTO**: a zod schema in the domain contract, passed to `.output()`.
  tRPC parses every response through it. Columns not listed are stripped, so
  a new private column on a table can never leak. Make outputs tolerant of
  real data (`z.coerce.number()` for Postgres numerics, string-list helpers for
  jsonb).
- Identity is never an input. The user, partner or agency acting comes from
  the session (`ctx.user.id`), and the service resolves memberships from it.

## Repository typing

- Reads use the generated schema (`SupabaseClient<Database>`) so precise row
  types reach the web app through tRPC. Writes go through an untyped accessor:
  their payloads are built by services from validated DTOs.
- When a procedure's inferred output is too deep for tRPC's client (TS2589),
  export the row type from the service (`export type X = Awaited<ReturnType<...>>`)
  and cast at the web call site, as `UmrahPackageAdmin` and `CheckoutOrderRow` do.
- Public and customer-facing reads declare `.output()`; admin reads may rely on
  the typed repository instead.

## Errors

- Services throw Nest exceptions (`BadRequestException`, `ForbiddenException`,
  `NotFoundException`). `trpc/trpc.ts` maps them to tRPC codes.
- Repositories call `throwIfDbError(error, "One plain line.")`. Only Postgres
  `P0001` messages (a guard's own `RAISE`) reach the client. Everything else
  is logged in full and answered with the fallback line.
- Messages follow the copy standard: one short line, no ceremony.

## Module boundaries

- Another module is reached through its `index.ts` or its exported service
  (`EventsService` uses `OrdersService`, never orders' tables).
- `no-restricted-imports` in `eslint.config.mjs` fails the lint when code
  imports another module's `repositories/` or `mappers/`.
- Hub tables (`profiles`, `orders`, `order_items`, `payments`, `notifications`)
  are read through their owning module's service when another module needs them.

## Config, logging, tests

- File uploads are a REST multipart controller in the module (tRPC doesn't carry
  binary); apps/web forwards the session with `apiUpload()`.
- `env()` from `config/env.ts`, never `process.env`. Add new variables to the
  schema first; the app refuses to start without the required ones.
- Every tRPC call logs one line: type, path, status, duration, user id. Bodies
  and tokens are never logged.
- Contract rules are tested in `packages/shared-types/test` with Node's built-in
  runner (`npm test -w @sts/shared-types`). New pure rules get a test there.

## New module checklist

1. Contract file `packages/shared-types/src/<domain>.ts` with input and output
   schemas, re-exported from `index.ts`.
2. Repositories for every table the module owns.
3. Service with the rules, injecting repositories and other modules' services.
4. Router with `.input()` and `.output()` on every procedure.
5. `index.ts` exporting the module, service and router; register via that path
   in `app.module.ts` and `trpc/router.ts`.
6. Tests for any pure rule.
7. `npx tsc --noEmit`, `npm run lint`, `npm test -w @sts/shared-types`.
