<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- CUSTOM:resource-management:START -->
## Low-resource PC — mandatory cleanup

This workstation has very limited CPU and memory. Start only the services
needed for the current task and run resource-heavy checks sequentially.

- Track every server, watcher, container and background job started for a task.
- After localhost testing or preview work is complete, stop the Next.js server,
  local API server, Supabase stack, Docker containers and Docker daemon used
  for the task, along with any related watchers, indexing jobs or other
  background processes. Stop Docker's socket as well so it cannot restart
  the daemon automatically.
- Do not leave services running for a handoff or preview link unless the user
  explicitly asks to keep them running. Cleanup is the default and requires
  no additional confirmation.
- Close temporary browser preview tabs and verify that the tracked processes
  have exited and their ports are no longer listening before finishing.
- Stop services gracefully. Preserve databases, volumes, images and files;
  freeing resources does not authorize deleting data or pruning Docker.
- Do not stop unrelated user applications. If cleanup is blocked by permissions,
  report exactly which service remains running.
<!-- CUSTOM:resource-management:END -->

<!-- CUSTOM:copy-standard:START -->
## Copy & content standard — applies everywhere in this app

STS is an ISO-certified company. Every user-facing string — marketing
pages, checkout, portals, emails, error/success/toast messages — must
read as professional and deliberate, never as generic AI-generated
filler. This is not scoped to any one area; check it on every page you
touch.

- No sentence under a heading or field that explains how the feature
  behaves, restates the label, or reassures about a consequence — even
  when it's true and non-obvious. This is not "trim it," it's "it doesn't
  ship." Users learn behavior from using the control or from an inline
  validation error, not from standing caption prose.
- No filler qualifiers or hedge words ("simply", "easily", "seamlessly",
  "in just a few clicks", "effortlessly").
- Error and success messages: one short plain-fact line, no ceremony
  ("Manager added." not "The manager has been successfully added.").
- Marketing/public pages (landing, Umrah, visa, checkout, hotels) may be
  warmer and persuasive — that register is correct there — but still
  concrete and specific, never generic travel-marketing cliché
  ("unlock your dream journey", "experience the magic of...").
- Internal consoles (admin, partner, agent, affiliate, venue, account)
  follow the stricter, more detailed standard in
  `.claude/skills/sts-admin-ui/SKILL.md` (zero `CardDescription`/`<p>`
  helper text under headings or fields, no exceptions) — that skill
  auto-loads when editing those paths; invoke it explicitly if it doesn't.

Read any new sentence back and ask whether the surrounding UI already
makes it obvious. It almost always does — cut it rather than keep it.
<!-- CUSTOM:copy-standard:END -->

<!-- CUSTOM:git-attribution:START -->
## Git commit / PR attribution

Do not add a `Co-Authored-By: Claude ...` trailer, or any other Claude/
Anthropic attribution line, to commit messages or PR descriptions in
this repo. Commits are authored by the human operating the CLI; leave
authorship as just that.
<!-- CUSTOM:git-attribution:END -->

## CI/CD and release flow

Environments

| | Branch | Deploy workflow | URL | Notes |
|---|---|---|---|---|
| QA | `main` | `deploy.yml` (AWS) | http://54.74.179.142:3000 | Demo logins on |
| Production | `production` | `deploy-production.yml` (GHCR + SSH, Mogadishu) | https://scoutsts.com | No demo logins, ever |

Supabase: QA and production currently share one project
(`uvmxxtdneryuuiqcwegx`). The separate production project
(`mdhftphdyqsbxpoblzsd`) stays unused until the split is scheduled.

Change flow, in order, with no step skipped:

1. **Branch.** Cut a new branch from an up-to-date `origin/main` for each
   piece of work: `feat/…`, `fix/…`, `perf/…`, `chore/…`, `docs/…`. Never
   edit on `main` or `production`; never stack unrelated work on one branch.
   Local `main` is kept fast-forwarded to `origin/main`.
2. **Commit.** Conventional Commits (`feat(scope): …`), one logical change
   per commit, no attribution trailers. Never commit secrets, `.env*`,
   `.secrets/`, or credentials files.
3. **Verify locally.** From `apps/web`: `npx tsc --noEmit -p .` and
   `npx eslint <touched paths>`. From `apps/api`: `npx tsc --noEmit -p .`.
   Do not start dev servers or builds unless the user asks.
4. **Pull request into `main`.** CI (`.github/workflows/ci.yml`: `api` and
   `web` jobs — lint, build, type check) must be green. Merge with a merge
   commit. Merging deploys QA automatically.
5. **Verify on QA.** The deploy run is green, then spot-check the changed
   pages on the QA URL. Fix forward on a new branch; never push fixes
   straight to `main`.
6. **Promote.** Open a PR `main` → `production` and merge it only when the
   user asks. Never push directly to `production`, never merge a branch into
   `production` that has not been on `main`.
7. **Verify production.** The `deploy-production` run is green, then check
   https://scoutsts.com: the changed pages, `/api/health`, and one login.

Rules that apply at every step:

- Configuration follows the same path as code: environment variables,
  GitHub secrets/variables, Docker compose and Caddy changes reach QA
  before production. Secrets live in GitHub Environments (`Production`) or
  the server's env file, never in the repo.
- Database migrations are not run by either deploy. Apply a migration to
  the QA database first, verify, then to production. Never edit a migration
  that has been merged; add a new one.
- Rollback: revert the merge commit on a new branch and promote it through
  the same flow. For an outage, re-run the previous successful deploy run.
  Hotfix: branch from `production`, PR into `production`, then merge
  `production` back into `main`.
- Merge PRs one at a time and wait for the QA deploy to finish before the
  next merge.
- Commit and push when work is complete. Merge to `main` (QA) after each
  push. Merge to `production` only on an explicit ask.

Recommended repository settings (admin): require the `api` and `web` checks
and a pull request on `main` and `production`; block force-pushes and
deletion; require reviewers on the `Production` environment; delete head
branches on merge.

<!-- REPOWISE_AGENTS:START — Do not edit below this line. Auto-generated by Repowise. -->
## Codebase Intelligence for sts_somalia_client (Repowise)

Indexed by [Repowise](https://repowise.dev). Last indexed: 2026-10-30 (commit eebffbb). Confidence: 100%.
### How to work in this repo

- **Trust the index.** `verified: true` means the bytes were checked against the live tree, so never re-read those lines. Re-read only on `bounds: "approximate"`, `_meta.stale_warning`, `search_method: "bm25"` or `confidence: "low"`; `index_behind: true` alone is informational.
- **Pre-edit, not instead-of-edit.** These tools decide *which* files to read and edit. Reading a file before you edit it is correct and expected.
- **Noisy commands** (tests, builds, `git log`/`diff`, searches, listings): prefer `repowise distill <cmd>`, the same command with its exit code preserved and errors-first output. A `[repowise#<ref>: N lines omitted]` marker is recoverable via `repowise expand <ref>` (add `-q <regex>` to filter); never re-run the command to see omitted output.
- **Recording a decision** you had to reason out: `repowise decision add --title T --decision D` records it without prompting and prints the id (`--format json` to parse it back). It lands `proposed`, for a person to confirm.

### Tools

| Tool | When and why |
|------|--------------|
| `get_answer(question)` | First call for any how/where/why question. Cite `confidence: "high"` or `grounding: "extracted"` directly; `degraded` means judge by `retrieval_quality`. `symbol_bodies` has live bodies. |
| `get_context(targets=[...])` | Triage card for files/modules/symbols: docs, signatures, hotspot, fix history. No source bytes — `include=["skeleton"]` for the whole file verified, `["callers"|"decisions"]` for depth. Batch targets. |
| `get_symbol(id)` | **Follow-up, not an entry point** — one verified body for an id a prior response named (`path.py::Name`, `path.py:140-180`, `repowise#<hex>`). Never walk a file symbol by symbol; Read it. |
| `search_codebase(query)` | Hybrid search, auto-routed by query shape; force with `mode=symbol|path|concept|hybrid`. A hit whose `sources` are `[fts]` only has no semantic agreement, so verify it. |
| `get_why(query, targets?)` | Why the code is shaped this way: decision records, git archaeology, rationale comments. Call before a refactor or a pattern divergence. |
| `get_risk(targets, changed_files?)` | What history says about touching these files. PR mode (`changed_files`) leads with a `directive`: read `will_break` / `missing_cochanges` / `missing_tests` / `tests_to_run` first. |
| `get_change_risk(revspec, extensions?, exclude_patterns?)` | Defect score for a whole commit or `base..head` range, from its diff on the live checkout. Lead with `risk_percentile`. Scores a range; `get_risk` scores paths. |
| `get_health(targets?, include?)` | Defect / maintainability / performance scores and findings. Self-check the files you touched before finishing. |
| `get_dead_code()` | Confidence-tiered unreachable files / unused exports / zombie packages. For cleanup sweeps, not targeted fixes. |
| `get_overview()` | Architecture map. Call once, first, in an unfamiliar repo; skip it after that. |

### Architecture
**Files:** 607 | **Lines:** 84930 | **Import cycles:** 1
sts_somalia_client is a typescript codebase of 607 files. Execution starts at src/lib/supabase/server.ts. Start here when reading the codebase. Ranked by PageRank over the import graph: the files most of the codebase ultimately depends on.

### Key modules
- `src/modules` — src/modules/admin · src/modules/admin/components · src/modules/admin/integrations · src/modules/affiliates · src/modules/agencies ·…
- `src/app` — src/app · src/app/(auth) · src/app/(auth)/forgot-password · src/app/(auth)/login/verify-2fa · src/app/(auth)/reset-password ·…
- `src/components/ui` — src/components/ui
**Language:** typescript | **Files:** 34 | **Public symbols:** 186 / 206
Covers the 34 source files in src/components/ui
- `src/lib` — src/lib · src/lib/auth · src/lib/notifications · src/lib/provider-runtime · src/lib/supabase · src/lib/types
**Language:** typescript |…
- `src/lib/provider-runtime` — src/lib/provider-runtime · src/lib/supabase · src/lib/types
**Language:** typescript | **Files:** 10 | **Public symbols:** 28 / 71
Covers…
- `src/components/marketing` — src/components/marketing
**Language:** typescript | **Files:** 44 | **Public symbols:** 80 / 140
Covers the 44 source files in…
- `src/lib/auth` — src/lib/auth · src/lib/notifications
**Language:** typescript | **Files:** 11 | **Public symbols:** 42 / 66
Covers the 11 source files in 2…
- `src/modules/admin` — src/modules/admin
**Language:** typescript | **Files:** 15 | **Public symbols:** 135 / 226
Covers the 15 source files in src/modules/admin
- `src/components` — src/components · src/components/admin · src/components/auth · src/components/dashboard · src/components/marketing · src/components/portal ·…
- `src/modules/visa` — src/modules/visa · src/modules/visa/components · src/modules/visa/partner · src/modules/visa/partner/adapters
**Language:** typescript |…

### Entry points
- `apps/api/src/main.ts`
- `apps/web/src/lib/supabase/server.ts`
- `apps/web/src/lib/trpc/server.ts`

### Files that need care (bug-fix history first, then churn — check `get_risk` before editing)
- `apps/web/src/components/portal/portal-shell.tsx` — 2 bug fixes, last fix 2 days ago; 12 commits/90d
- `apps/web/src/modules/admin/queries.ts` — 2 bug fixes, last fix 6 days ago; 16 commits/90d
- `apps/web/src/lib/auth/actions.ts` — 2 bug fixes, last fix 5 weeks ago; 9 commits/90d
- `apps/web/src/modules/flights/components/flight-search-form.tsx` — 2 bug fixes, last fix 5 weeks ago; 10 commits/90d
- `apps/web/src/components/marketing/flights-hero.tsx` — 2 bug fixes, last fix 5 weeks ago; 6 commits/90d

### Code health
Three co-equal signals: defect risk 8.17/10 avg, hotspot health 6.52/10 (stable), worst `apps/web/src/modules/visa/actions.ts` at 1.64/10 · maintainability 9.18/10 · performance risk 33 open static I/O-in-loop / N+1 findings. Detail: `get_health()`.

Critical files:
- `supabase/seed.sql` — change entropy — impact −3.0
- `apps/web/src/modules/hotels/components/offline-booking-panel.tsx` — change entropy — impact −3.0
- `apps/web/src/modules/hotels/components/new-booking-form.tsx` — change entropy — impact −3.0
- `apps/web/src/modules/hotels/components/front-desk-grid.tsx` — change entropy — impact −3.0
- `apps/web/src/modules/hotels/components/availability-board.tsx` — change entropy — impact −3.0

<!-- REPOWISE_AGENTS:END -->
