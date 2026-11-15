# Follow-up to family visa QA — 15 November 2026

Status: deployed to QA. All three migrations applied to QA project uvmxxtdneryuuiqcwegx. Source commit c296283; main merge 7e814d4f42bbe8a330a44d4c02f948739f4d8cee. Deployment 43679645590 completed successfully. Production was not changed.

## Fixes deployed

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

## Browser retest on deployed QA

- Configured an India-only override on the existing QA ONLY Kenya product: USD 25 plus USD 3 processing fee and a QA residence document. Base price remained USD 10. Genuine catalog products were untouched.
- Created synthetic family application **STS-VISA-2026-000029**, UUID `7bc3c320-7f1b-47d7-b6e0-7d7bd43db2db`, order **STS-2026-000075**. Two-person mixed-nationality case: Somalia parent and India spouse. Existing three-person family case 000027 was used for six-file pack preparation.
- Personal fields, dates, gender, nationality, calling code and phone recovered after same-tab reload. Travel dates, purpose, address and all six per-traveller question answers recovered after reload.
- Opened an older second tab before the first personal save. The first save succeeded. Saving distinct stale data in the second tab returned: “This application changed in another tab. Refresh before saving.” Review and admin retained the first tab’s parent name.
- Customer document step displayed Somalia parent passport requirement and India spouse residence requirement, each under its named owner. Both synthetic uploads completed when started together.
- Review showed two named documents and USD 35 visa fees plus USD 3 processing fee. Submission succeeded; checkout retained USD 38 total. No payment was initiated or approved for this new case.
- Admin received both nationalities, passport details, travel data, per-person custom answers, both document owners and the same USD 38 order. Start review was disabled with “Review blocked · Payment not confirmed” and the outstanding balance.
- Prepared existing case 000027 for synthetic `visa-office@example.test`, without opening or sending Gmail. Visible draft included all three applicants and six verified attachments. Download capture remains incomplete as described below.
- Evidence: `mixed-nationality-review.jpg`, `mixed-nationality-checkout.jpg`, `stale-save-blocked.jpg`, `admin-mixed-family.jpg`, `submission-download-ready.jpg`.

## Remaining verification and integration boundaries

- Applied QA migrations: 20261115000002, 20261115000003, 20261115000004.
- Top replacement-name correction still needs a separate browser retest.
- The prepared pack exposed the persistent Download submission pack link and Gmail draft for all six verified documents. Both browser download-event capture and downloadMedia timed out; actual downloaded ZIP bytes were not available for inspection. This browser test is incomplete, not a passed download claim.
- Existing office-payment simulation and family rejection/replacement checks from the original report remain valid for the previously deployed version. They were not repeated in this follow-up deployment test.
- Real online gateway settlement requires the STS merchant integration, explicitly deferred by the user. Online payment remains unavailable until configured; no live payment was made.
- Sending from the admin's Gmail and verifying actual email delivery requires the admin's Gmail session and intended recipient. No real authority email was sent. Attachments remain a manual Gmail step.
- Full appointment/passport custody UI walkthroughs and production network conditions have not been established by these isolated tests. Tests use small fixtures and stub unrelated lifecycle helpers, not the entire live backend.
- The existing 5MB document and 12MB submission-pack limits remain enforced. Large-group packs above that limit need a separately agreed secure-transfer/multiple-message workflow; no public document links were introduced.
- PDF visual checks cover Latin text and pagination. Built-in PDF font coverage for other writing systems remains a separate limitation.

## Cleanup

Temporary PostgreSQL stopped; no development servers were started. All three follow-up browser tabs were closed. Unrelated apps/web/.env.example changes are untouched.
