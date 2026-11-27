# Deployment routes

| Merge target | Workflow | Destination |
| --- | --- | --- |
| `main` | `QA deployment` (`deploy.yml`) | QA AWS services |
| `client_impression` | `client_impression` | Existing STS Vercel preview project |
| `production` | `Production deployment` (`deploy-production.yml`) | Production server; existing enable flag and environment approvals apply |

PRs into any of these branches run the same quality workflow (`ci.yml`). Each
release repeats that quality gate for the exact merged commit before deployment.
The shared gate includes API/web lint, API build, web type checking, shared-type
and booking/auth/email regression tests, ephemeral PostgreSQL integration tests,
and deployment-isolation policy tests. Failed checks prevent deployment. Manual
runs have branch guards too. Successful builds and historical check results stay
attached to commits even when those commits are subsequently merged elsewhere.

Vercel Git auto-deployment is disabled in `apps/web/vercel.json`. GitHub Actions
owns the client deployment, waits for the Vercel preview build to succeed, then
updates the existing shared alias. It never passes `--prod`, promotes a deployment,
or uses the QA/production release credentials. Concurrent client releases are
serialized. Vercel authentication protection remains enabled.

## Activation

1. Store a Vercel token authorized for the existing STS project/team as the
   `VERCEL_TOKEN` GitHub Actions secret (repository level or the
   `client_impression` environment). Never commit a token.
2. Commit this configuration to `client_impression` and publish that branch.
   Bring the workflow configuration into `main` through the normal review flow;
   this does not make `main` deploy to Vercel.
3. Configure branch protection on all three branches to require PRs and the CI
   `api`, `web`, and `Deployment isolation` checks. Require production reviewers
   in the existing production environment. Branch protections are repository
   settings, not set by these workflow files.
4. Merge preview changes into `client_impression`. The Actions deployment summary
   contains the shared URL and deployed commit. The original `feat/reference-ui-vercel`
   branch is no longer a deployment source once this configuration is applied.

Shared client URL:
https://sts-client-impression.vercel.app/design-preview

## QA payment configuration

QA uses the repository secrets `QA_INTEGRATIONS_ENCRYPTION_KEY`,
`QA_WAAFI_MERCHANT_UID`, `QA_WAAFI_API_USER_ID`, `QA_WAAFI_API_KEY`,
`QA_WAAFI_STORE_ID` and `QA_WAAFI_HPP_KEY`. Both QA services receive the same
encryption key and sandbox gateway configuration. The key must remain stable
while encrypted credentials exist in the QA database. QA releases stop if this
configuration is missing. Production does not reference these QA secrets.

Apply pending migrations to the linked QA database before releasing code that
depends on them. The deployment workflows do not apply database migrations.

For the STS SMTP mailbox on QA, configure Actions variables `QA_EMAIL_PROVIDER`
(`smtp`), `QA_EMAIL_FROM`, `QA_EMAIL_REPLY_TO`, `QA_SMTP_HOST`, `QA_SMTP_PORT`, `QA_SMTP_SECURE` and
`QA_SMTP_USER`, plus the encrypted Actions secret `QA_SMTP_PASS`. Both QA
services receive these settings. Ports 465 and 587 use `SMTP_SECURE=true` and
`SMTP_SECURE=false`, respectively; port 587 negotiates STARTTLS. Agent approval
requires a configured outgoing email provider. Failed deliveries retain the
encrypted credential copy for retry without issuing a new password.

### SMTP storage and rotation

- Local runtime settings live in ignored `apps/web/.env.local` and
  `apps/api/.env.local` files with mode `0600`. The API also supports the
  older `apps/api/.env` fallback; keep any retained mailbox settings consistent.
- Commit only the blank-password `.env.example` templates. Nested environment
  files are excluded from Docker build contexts; SMTP credentials are injected
  at runtime and never use a `NEXT_PUBLIC_` variable or image build argument.
- QA uses the `QA_` Actions settings above. Production uses its existing
  `production` GitHub Environment variables and `SMTP_PASS` secret, independently
  of QA. Preparing QA mail does not configure or deploy production.
- QA deployments write an owner-only temporary env file and replace the runtime
  file atomically. Production already writes its env file under `umask 077`.
- To rotate the mailbox password, update the Hostinger mailbox password, the
  appropriate deployment secret and local env files, then redeploy that
  environment. Restarting services loads the new configuration. Never put the
  password in documentation, logs, screenshots or commits.

## Recovery

Revert the faulty change through a PR into the affected release branch, or rerun
its known-good workflow revision on that same branch. Retained Vercel deployments
can be reassigned to the client alias by a project administrator. Do not merge a
client-only design into `main` merely to redeploy the preview. No database
migrations run in these workflows.

## References

- https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows
- https://vercel.com/docs/project-configuration/git-configuration
- https://vercel.com/docs/cli/deploy
- https://vercel.com/docs/cli/alias
