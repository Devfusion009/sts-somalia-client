# Follow-up to family visa QA — 15 November 2026

Status: implemented locally; not committed, migrated to QA or deployed. The earlier QA deployment and screenshots in the parent report remain historical evidence, not proof of these new changes.

## Fixes prepared

- Each traveller resolves their own nationality-specific price, processing fee, required documents and eligibility text. Review totals sum the individual amounts. Submission freezes the per-traveller quote in workflow data; later catalog edits do not change it. Legacy submitted cases retain their existing resolved requirements.
- Admin document groups and customer replacement labels retain traveller ownership for nationality-specific documents too. Duplicate primary/member passports are rejected.
- Personal and travel information save application and traveller rows in one database transaction. Failed writes roll back; the displayed application revision prevents stale tabs overwriting newer data. Traveller/document edits invalidate earlier wizard revisions.
- Unsaved personal/travel fields can recover in the same browser tab after reload, for 30 minutes and only at the same server revision. Files and credentials are excluded. Recovery expires and is cleared on successful save.
- Prepared submission packs now have a persistent download link, allowing manual retry. Editing the recipient or message invalidates the old pack/draft and cancels preparation; preparation can be cancelled. No email is sent automatically.
- Uploads allow five minutes overall, reset a 45-second stall timer when progress arrives, and remain cancellable. Metadata finalisation still rejects invalid files and unknown outcomes require checking status.
- Family submission now requires biometrics for every traveller, unless explicitly recorded on a shared attended appointment. Missing passport records and lost/unreceived passports block submission. Cancelled appointments do not count.
- Invoices show amount paid and balance due, including partial payments. Multi-page invoices reserve footer space, keep rows/totals together, and avoid clipped continuation rows.

## Local validation

- Web and API TypeScript checks; ESLint on changed source files.
- Nine targeted Node test files passed, including new recovery, mixed-nationality pricing/requirements and slow/stalled transfer cases.
- Isolated PostgreSQL tests execute the new migration functions for mixed-nationality required documents and totals, immutable submitted quotes, access restrictions, stale tab rejection, atomic rollback, child-edit invalidation, family biometrics, shared/cancelled appointments, and missing/lost passports.
- Rendered four actual InvoiceDocument fixtures: paid, partial, unpaid proforma, and a 25-item long invoice. Inspected rendered pages. Partial case shows USD 60 paid and USD 120 due on a USD 180 invoice; long invoice no longer overlaps the footer or clips a continued row. Fixtures are synthetic, not issued accounting documents.

## Remaining verification and integration boundaries

- Three pending QA migrations: 20261115000002, 20261115000003, 20261115000004. Apply before deploying this batch.
- New UI behaviour still needs browser retesting after QA deployment: mixed-nationality family totals/checklists, reload recovery, stale-tab errors, explicit pack download/ZIP inspection, and the top replacement-name correction.
- Existing office-payment simulation and family rejection/replacement checks from the original report remain valid for the previously deployed version. They are not repeated claims about this unshipped batch.
- Real online gateway settlement requires the STS merchant integration, explicitly deferred by the user. Online payment remains unavailable until configured; no live payment was made.
- Sending from the admin's Gmail and verifying actual email delivery requires the admin's Gmail session and intended recipient. No real authority email was sent. Attachments remain a manual Gmail step.
- Full appointment/passport custody UI walkthroughs and production network conditions have not been established by these isolated tests. Tests use small fixtures and stub unrelated lifecycle helpers, not the entire live backend.
- The existing 5MB document and 12MB submission-pack limits remain enforced. Large-group packs above that limit need a separately agreed secure-transfer/multiple-message workflow; no public document links were introduced.
- PDF visual checks cover Latin text and pagination. Built-in PDF font coverage for other writing systems remains a separate limitation.

## Cleanup

Temporary PostgreSQL stopped; no development servers were started. Unrelated apps/web/.env.example changes are untouched.
