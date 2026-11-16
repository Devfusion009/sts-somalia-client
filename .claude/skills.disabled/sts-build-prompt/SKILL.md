---
name: sts-build-prompt
description: How to write build prompts and build specs for the STS Somalia repo — the context/task/constraints/acceptance/verification structure, the repo traps every prompt must inoculate against, and when a prompt isn't warranted. Use when writing a prompt a fresh Claude Code session will execute, drafting or updating a build spec under docs/, breaking a feature into milestones, or planning multi-step work someone else will pick up later. For UI and copy standards inside a portal, use sts-admin-ui instead.
---

# STS build-prompt standard

A build prompt here is executed by a session with **none of your context**: no
memory of the audit you just ran, no idea which decisions were already settled,
no reason to trust anything you assert. Everything that session needs must be in
the prompt or in a file the prompt names. The two worked references in this repo
are `docs/VISA-MODULE-BUILD-SPEC.md` (eight milestone prompts, §5; the inherited
house rules, §6) and `docs/B2B-PORTAL-SEPARATION-BUILD-PROMPT.md` (decisions
table, audited current state with real `file:line`, numbered build order).

## The skeleton

Five sections, in this order. Each exists because leaving it out produced a
specific failure on this project.

**`<context>`** — why this work exists and what is already true. Name the real
files, tables, and functions involved, and say what is *missing* versus what
merely looks missing. Without it the session re-derives the codebase from
scratch, usually wrongly, and rebuilds something that already exists. Include
the motivation, not just the facts: "staff currently resolve this over WhatsApp"
tells the session what good looks like in a way a schema diff cannot.

**`<task>`** — numbered, ordered, imperative. "Add a `ready_for_processing`
value to the enum", not "consider whether a new status is needed". Phrase every
item as something that is done, not something that is evaluated — a session
asked to *suggest* changes will suggest them and stop.

**`<constraints>`** — what not to touch, and which *other* milestone owns it.
"Do not change the wizard, the document model, or the partner abstraction —
those are M2 and M3" both prevents scope creep and tells the session the
boundary is deliberate rather than an oversight. This is also where you name the
one design invariant that must survive: "do not add a second way to change
status; the whole point is that the function is the only door."

**`<acceptance>`** — observable outcomes, not implementation notes. "An illegal
transition raises, and the admin UI shows the error" is checkable; "the state
machine is robust" is not.

**`<verification>`** — how to prove it before claiming done, naming the exact
commands and the traps below. A session that verifies nothing will report
success on code that has never run.

## Rules that make a prompt work here

- **Ground it, then say so.** Add: "Never speculate about code you have not
  opened; read the file before editing it." This codebase has near-identical
  patterns repeated across five portals and several verticals, so a plausible
  guess is usually wrong in a specific, expensive way.
- **Point at prior art by path.** "Read
  `supabase/migrations/20260907000001_notify_wallet_booking_payment.sql` first;
  it is the pattern to follow" beats any amount of describing the pattern.
- **Distinguish shape-to-mirror from code-to-reuse.** Say which one you mean.
  The visa document loop mirrors the *shape* of
  `20260823000001_document_rejection_loop.sql` but must not reuse it — the
  resolver it depends on has no visa branch by design.
- **Self-contained per milestone.** Assume no shared session state between
  prompts. Restate the dependency instead ("M1 must be merged before starting").
- **Gate on decisions.** If a business question is unanswered, say so in the
  prompt and tell the session not to start. A locked decision belongs in the
  prompt verbatim, with its rationale.
- **State what was not verified.** Require the session to say plainly what it
  could not confirm rather than rounding up to "done".

## Traps every prompt must inoculate against

These have each cost this project real time. Copy the block from
`docs/VISA-MODULE-BUILD-SPEC.md` §6 rather than retyping it, or restate these:

- **Copy standard.** `AGENTS.md` and `sts-admin-ui` govern every user-facing
  string: no `CardDescription`, no `<p>` under a heading or field, one plain
  line for errors and successes. Require the grep-the-touched-directory pass —
  checking only the text just written has let violations ship repeatedly, found
  later in files that were merely sitting near the work.
- **State transitions belong in Postgres.** SECURITY DEFINER functions, the way
  `cancel_order`, `apply_agency_wallet_transaction`, and the top-up/payout
  approvals already do it — that is why notifications fire regardless of which
  call site triggered the change. A status column updated from a server action
  is a bug waiting for the second call site.
- **Schema changes have a tail.** Migrations are
  `supabase/migrations/YYYYMMDDNNNNNN_snake_case.sql` and additive. After any
  schema change: `npm run db:types`, then `npm run build -w @sts/shared-types`,
  or the web app typechecks against a stale schema and the failure looks
  unrelated.
- **Test DB work in a rolled-back transaction.** psql against
  `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, impersonating a
  real user with `set local role authenticated;` and `set local
  request.jwt.claims = '{"sub":"<profile-id>","role":"authenticated"}';`, wrapped
  in `BEGIN; … ROLLBACK;`.
- **The RLS read-back trap.** A `SELECT` run as the impersonated user cannot see
  other profiles' notification rows, so a working admin fan-out reads as zero
  rows inserted. `reset role` before reading back. This exact trap sent a
  session down a long false debugging path.
- **Verification commands.** `npx tsc --noEmit -p apps/web/tsconfig.json` and
  `npm run lint:web` clean. Browser automation is not available on this project
  — verify through SQL, typecheck, and reading code.
- **Scope discipline.** No speculative abstractions, no error handling for cases
  that cannot occur, no comments or docstrings on code that was not changed, no
  refactoring adjacent code while passing through.
- **No commits.** The repo owner commits every milestone.

## Worked example

Weak:

> add notifications to visa

Nothing here says what fires, to whom, on which events, or how anyone would know
it worked. A session will invent an answer to all four.

House format:

```
Add status-change notifications to the visa module. Read
docs/VISA-MODULE-BUILD-SPEC.md §1 (audited current state) and §6 (house rules)
first — do not re-derive the current state.

<context>
Confirmed by an exhaustive migration grep: zero notifications fire for any visa
event. A customer who submits an application, gets a document request, or gets a
decision is told nothing — only an audit row and a status-history row are
written. This is the same gap shape as the agency-wallet one fixed in
supabase/migrations/20260907000001_notify_wallet_booking_payment.sql; read that
migration first, it is the pattern to follow.
</context>

<task>
1. Fan out notifications from the status-transition function: the applicant
   always, every platform admin on `submitted`, and the booking agency's members
   when visa_applications.agency_id is set.
2. Use type `visa_status_changed`, with `data` carrying applicationId and
   applicationRef so the bells can link through.
3. Add that type to the click-through maps in the admin, agent, and customer
   notification bells.
</task>

<constraints>
Do not add a second write path for status — notifications belong inside the
existing transition function so they fire regardless of call site. No caption
prose in any new UI string (§6).
</constraints>

<acceptance>
- One notification row per recipient per legal transition, no duplicates.
- An agency-booked application notifies agency members as well as the applicant.
</acceptance>

<verification>
Walk one real application through the full status path in psql (BEGIN/ROLLBACK)
and assert the rows at each hop. Read notification rows back with `reset role` —
as the impersonated applicant, RLS hides the admin rows and the fan-out will look
broken. Then typecheck and lint per §6.
</verification>
```

Full milestone-sized examples: `docs/VISA-MODULE-BUILD-SPEC.md` §5.

## When not to write one

A one-line fix, a question about how something works, or a change you are about
to make yourself in the same session does not need this structure — it needs the
edit. The overhead earns its place when the work will be executed by a session
that cannot ask you a follow-up question: a milestone handed off, a spec checked
into `docs/`, or a task large enough that scope will drift without a written
boundary.
